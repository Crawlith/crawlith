import { describe, it, expect, vi } from 'vitest';
import { IPGuard } from '../src/core/security/ipGuard.js';
import * as dns from 'dns';

vi.mock('dns', () => ({
    lookup: vi.fn(),
    resolve4: vi.fn(),
    resolve6: vi.fn(),
}));

describe('IPGuard Secure Lookup', () => {
    it('should resolve safe IPs', () => {
        const lookupMock = vi.mocked(dns.lookup);
        // Mock successful resolution
        lookupMock.mockImplementation((hostname, options, callback) => {
            callback(null, '8.8.8.8', 4);
        });

        const callback = vi.fn();
        IPGuard.secureLookup('google.com', {}, callback);

        expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4);
    });

    it('should block internal IPs', () => {
        const lookupMock = vi.mocked(dns.lookup);
        // Mock internal IP resolution
        lookupMock.mockImplementation((hostname, options, callback) => {
            callback(null, '127.0.0.1', 4);
        });

        const callback = vi.fn();
        IPGuard.secureLookup('localhost', {}, callback);

        expect(callback).toHaveBeenCalledWith(expect.any(Error), '127.0.0.1', 4);
        const error = callback.mock.calls[0][0];
        expect(error.message).toContain('Blocked internal IP');
        expect(error.code).toBe('EBLOCKED');
    });

    it('should handle array of IPs (IPv4)', () => {
        const lookupMock = vi.mocked(dns.lookup);
        // Mock array resolution
        lookupMock.mockImplementation((hostname, options, callback) => {
             // Mocking address array structure
             const addresses = [
                 { address: '1.1.1.1', family: 4 },
                 { address: '127.0.0.1', family: 4 }
             ];
             callback(null, addresses as any, 4);
        });

        const callback = vi.fn();
        IPGuard.secureLookup('mixed.com', { all: true } as any, callback);

        expect(callback).toHaveBeenCalledWith(expect.any(Error), expect.anything(), 4);
        const error = callback.mock.calls[0][0];
        expect(error.message).toContain('Blocked internal IP');
    });

    it('should pass through DNS errors', () => {
        const lookupMock = vi.mocked(dns.lookup);
        const dnsError = new Error('ENOTFOUND');
        lookupMock.mockImplementation((hostname, options, callback) => {
            callback(dnsError as any, undefined as any, 0);
        });

        const callback = vi.fn();
        IPGuard.secureLookup('invalid.domain', {}, callback);

        expect(callback).toHaveBeenCalledWith(dnsError, undefined, 0);
    });
});
