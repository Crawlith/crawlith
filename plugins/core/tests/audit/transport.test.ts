import { describe, it, expect, vi, afterEach } from 'vitest';
import { analyzeTransport } from '../../src/audit/transport.js';
import https from 'node:https';
import tls from 'node:tls';
import { EventEmitter } from 'events';

vi.mock('node:https');
vi.mock('node:http');

describe('Transport Diagnostics', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should analyze HTTPS transport', async () => {
    // Mock Response
    const mockRes = new EventEmitter() as any;
    mockRes.statusCode = 200;
    mockRes.statusMessage = 'OK';
    mockRes.headers = {
      'content-encoding': 'gzip',
      'server': 'nginx',
      'connection': 'keep-alive'
    };
    mockRes.httpVersion = '1.1';

    const mockSocket = new EventEmitter();
    Object.setPrototypeOf(mockSocket, tls.TLSSocket.prototype);
    (mockSocket as any).getPeerCertificate = () => ({
      subject: { CN: 'example.com' },
      issuer: { CN: 'Let\'s Encrypt' },
      valid_from: 'Jan 1 2023',
      valid_to: 'Jan 1 2024',
      fingerprint: 'SHA256:...'
    });
    (mockSocket as any).getProtocol = () => 'TLSv1.3';
    (mockSocket as any).getCipher = () => ({ name: 'TLS_AES_...' });
    (mockSocket as any).alpnProtocol = 'h2';
    (mockSocket as any).authorized = true;

    mockRes.socket = mockSocket;

    // Mock Request
    const mockReq = new EventEmitter() as any;
    mockReq.end = vi.fn();
    mockReq.destroy = vi.fn();

    // Mock https.request
    vi.spyOn(https, 'request').mockImplementation((url, options, cb) => {
      if (cb) cb(mockRes);
      // Simulate socket events
      setTimeout(() => {
        mockReq.emit('socket', mockRes.socket);
        mockRes.socket.emit('lookup');
        mockRes.socket.emit('connect');
        mockRes.socket.emit('secureConnect');
        mockReq.emit('finish');
        // Response data
        mockRes.emit('data', Buffer.from('<html></html>'));
        mockRes.emit('end');
      }, 10);
      return mockReq;
    });

    const result = await analyzeTransport('https://example.com', 1000);
    expect(result.transport.tlsVersion).toBe('TLSv1.3');
    expect(result.transport.httpVersion).toBe('1.1');
    expect(result.performance.htmlSize).toBeGreaterThan(0);
    expect(result.transport.headers['server']).toBe('nginx');
  });

  it('should handle redirects', async () => {
    const req1 = new EventEmitter() as any; req1.end = vi.fn(); req1.destroy = vi.fn();
    const res1 = new EventEmitter() as any; res1.statusCode = 301; res1.headers = { location: 'https://example.com/' };
    res1.socket = new EventEmitter(); Object.setPrototypeOf(res1.socket, tls.TLSSocket.prototype);

    const req2 = new EventEmitter() as any; req2.end = vi.fn(); req2.destroy = vi.fn();
    const res2 = new EventEmitter() as any; res2.statusCode = 200; res2.headers = {};
    res2.socket = new EventEmitter(); Object.setPrototypeOf(res2.socket, tls.TLSSocket.prototype);

    // Setup res2 socket for TLS checks
    res2.socket.getPeerCertificate = () => ({});
    res2.socket.getProtocol = () => 'TLSv1.2';
    res2.socket.getCipher = () => ({ name: 'AES' });

    const requestSpy = vi.spyOn(https, 'request');
    requestSpy
      .mockImplementationOnce((url, options, cb) => {
        if (cb) cb(res1);
        setTimeout(() => {
           req1.emit('socket', res1.socket);
           res1.emit('data', Buffer.from('redirecting'));
           res1.emit('end');
        }, 10);
        return req1;
      })
      .mockImplementationOnce((url, options, cb) => {
        if (cb) cb(res2);
        setTimeout(() => {
           req2.emit('socket', res2.socket);
           res2.emit('data', Buffer.from('ok'));
           res2.emit('end');
        }, 10);
        return req2;
      });

    const result = await analyzeTransport('https://redirect.com', 1000);
    expect(result.transport.redirectCount).toBe(1);
    expect(result.transport.redirects[0].location).toBe('https://example.com/');
  });
});
