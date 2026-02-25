import { test, expect, beforeEach, vi } from 'vitest';
import { Fetcher } from '../src/crawler/fetcher.js';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { IPGuard } from '../src/core/security/ipGuard.js';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);

  // IPGuard.getSecureDispatcher must return the mockAgent so Fetcher uses it
  vi.spyOn(IPGuard, 'getSecureDispatcher').mockReturnValue(mockAgent as any);
});

test('fetches simple page', async () => {
  const client = mockAgent.get('https://example.com');
  client.intercept({ path: '/', method: 'GET' }).reply(200, 'Hello', {
    headers: { 'content-type': 'text/html', 'etag': '"123"', 'last-modified': 'Mon, 01 Jan 2000 00:00:00 GMT' }
  });

  const fetcher = new Fetcher();
  const res = await fetcher.fetch('https://example.com/');
  expect(res.status).toBe(200);
  expect(res.body).toBe('Hello');
  expect(res.etag).toBe('"123"');
  expect(res.lastModified).toBe('Mon, 01 Jan 2000 00:00:00 GMT');
  expect(res.redirectChain).toEqual([]);
});

test('follows redirects', async () => {
  const client = mockAgent.get('https://example.com');
  // A -> B
  client.intercept({ path: '/a', method: 'GET' }).reply(301, '', {
    headers: { location: '/b' }
  });
  // B -> C
  client.intercept({ path: '/b', method: 'GET' }).reply(302, '', {
    headers: { location: 'https://other.com/c' }
  });

  const otherClient = mockAgent.get('https://other.com');
  // C -> 200
  otherClient.intercept({ path: '/c', method: 'GET' }).reply(200, 'Final');

  const fetcher = new Fetcher();
  const res = await fetcher.fetch('https://example.com/a');

  expect(res.status).toBe(200);
  expect(res.body).toBe('Final');
  expect(res.finalUrl).toBe('https://other.com/c');
  expect(res.redirectChain.length).toBe(2);
  expect(res.redirectChain[0]).toEqual({ url: 'https://example.com/a', status: 301, target: 'https://example.com/b' });
  expect(res.redirectChain[1]).toEqual({ url: 'https://example.com/b', status: 302, target: 'https://other.com/c' });
});

test('detects redirect loop', async () => {
  const client = mockAgent.get('https://loop.com');
  // A -> B
  client.intercept({ path: '/a', method: 'GET' }).reply(301, '', { headers: { location: '/b' } });
  // B -> A (This will be detected as loop)
  client.intercept({ path: '/b', method: 'GET' }).reply(301, '', { headers: { location: '/a' } });

  const fetcher = new Fetcher();
  const res = await fetcher.fetch('https://loop.com/a');

  // Should return the redirect_loop security error
  expect(res.status).toBe('redirect_loop');
  expect(res.redirectChain.length).toBe(1); // Detected while resolving target of B
  expect(res.redirectChain[0].url).toBe('https://loop.com/a');
});

test('sends conditional headers', async () => {
  const client = mockAgent.get('https://cache.com');

  client.intercept({
    path: '/',
    method: 'GET',
    headers: {
      'If-None-Match': '"123"',
      'If-Modified-Since': 'Mon, 01 Jan 2000 00:00:00 GMT'
    }
  }).reply(304, '', { headers: { etag: '"123"' } });

  const fetcher = new Fetcher();
  const res = await fetcher.fetch('https://cache.com/', {
    etag: '"123"',
    lastModified: 'Mon, 01 Jan 2000 00:00:00 GMT'
  });

  expect(res.status).toBe(304);
  expect(res.body).toBe('');
});

test('handles max redirects', async () => {
  const client = mockAgent.get('https://max.com');
  // 11 redirects
  for (let i = 0; i < 11; i++) {
    client.intercept({ path: `/p${i}`, method: 'GET' }).reply(301, '', { headers: { location: `/p${i + 1}` } });
  }

  // Set maxRedirects to 10 to trigger failure exactly after 10 hops
  // Increase rate to prevent timeout (11 requests * 500ms > 5000ms)
  const fetcher = new Fetcher({ maxRedirects: 10, rate: 100 });
  const res = await fetcher.fetch('https://max.com/p0');

  expect(res.status).toBe('redirect_limit_exceeded');
  expect(res.redirectChain.length).toBe(10);
});
