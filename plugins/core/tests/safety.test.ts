import { describe, it, expect, vi } from 'vitest';
import { IPGuard } from '../src/core/security/ipGuard.js';
import { RateLimiter } from '../src/core/network/rateLimiter.js';
import { RetryPolicy } from '../src/core/network/retryPolicy.js';
import { ResponseLimiter } from '../src/core/network/responseLimiter.js';
import { Readable } from 'stream';
import * as dns from 'dns';

vi.mock('dns', () => ({
    resolve4: vi.fn(),
    resolve6: vi.fn(),
}));

describe('IPGuard', () => {
    it('should block IPv4 internal ranges', () => {
        expect(IPGuard.isInternal('127.0.0.1')).toBe(true);
        expect(IPGuard.isInternal('10.0.0.1')).toBe(true);
        expect(IPGuard.isInternal('192.168.1.1')).toBe(true);
        expect(IPGuard.isInternal('172.16.0.1')).toBe(true);
        expect(IPGuard.isInternal('172.31.255.255')).toBe(true);
        expect(IPGuard.isInternal('169.254.1.1')).toBe(true);
        expect(IPGuard.isInternal('0.0.0.0')).toBe(true);
    });

    it('should allow public IPv4', () => {
        expect(IPGuard.isInternal('8.8.8.8')).toBe(false);
        expect(IPGuard.isInternal('1.1.1.1')).toBe(false);
        expect(IPGuard.isInternal('172.32.0.1')).toBe(false);
    });

    it('should block IPv6 internal/local addresses', () => {
        expect(IPGuard.isInternal('::1')).toBe(true);
        expect(IPGuard.isInternal('fc00::1')).toBe(true);
        expect(IPGuard.isInternal('fe80::1')).toBe(true);
    });

    it('should block IPv4-mapped IPv6 internal addresses', () => {
        expect(IPGuard.isInternal('::ffff:127.0.0.1')).toBe(true);
        expect(IPGuard.isInternal('::ffff:10.0.0.1')).toBe(true);
        expect(IPGuard.isInternal('::ffff:192.168.1.1')).toBe(true);
        expect(IPGuard.isInternal('::ffff:169.254.169.254')).toBe(true);
        expect(IPGuard.isInternal('::ffff:7f00:0001')).toBe(true); // Hex 127.0.0.1
    });

    it('should allow IPv4-mapped IPv6 public addresses', () => {
        expect(IPGuard.isInternal('::ffff:8.8.8.8')).toBe(false);
    });

    it('should validate hostname by resolving IPs', async () => {
        const resolve4Spy = vi.mocked(dns.resolve4);
        const resolve6Spy = vi.mocked(dns.resolve6);

        resolve4Spy.mockImplementation((_h: string, cb: any) => cb(null, ['1.1.1.1']));
        resolve6Spy.mockImplementation((_h: string, cb: any) => cb(null, []));
        expect(await IPGuard.validateHost('example.com')).toBe(true);

        resolve4Spy.mockImplementation((_h: string, cb: any) => cb(null, ['127.0.0.1']));
        expect(await IPGuard.validateHost('localhost')).toBe(false);
    });
});

describe('RateLimiter', () => {
    it('should enforce rate limits', async () => {
        const limiter = new RateLimiter(1); // 1 req/sec = 1000ms interval
        const start = Date.now();

        await limiter.waitForToken('host1'); // returns immediately, tokens becomes 0
        await limiter.waitForToken('host1'); // waits for refill (1s)

        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(1000);
    }, 5000);

    it('should have separate buckets for hosts', async () => {
        const limiter = new RateLimiter(1);
        const start = Date.now();

        await limiter.waitForToken('host1');
        await limiter.waitForToken('host2');

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(100);
    });

    it('should respect crawlDelay if higher than rate', async () => {
        const limiter = new RateLimiter(1); // 1000ms interval
        const start = Date.now();

        await limiter.waitForToken('host3'); // returns immediately, tokens = 0
        await limiter.waitForToken('host3', 1); // 1s crawl delay

        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(1000);
    }, 5000);
});

describe('RetryPolicy', () => {
    it('should retry transient failures', async () => {
        let calls = 0;
        const result = await RetryPolicy.execute(
            async () => {
                calls++;
                if (calls < 3) throw new Error('Status 500');
                return 'success';
            },
            (err) => err.message === 'Status 500',
            { maxRetries: 3, baseDelay: 10 }
        );

        expect(result).toBe('success');
        expect(calls).toBe(3);
    });
});

describe('ResponseLimiter', () => {
    it('should stream to string', async () => {
        const stream = Readable.from(['hello ', 'world']);
        const result = await ResponseLimiter.streamToString(stream, 100);
        expect(result).toBe('hello world');
    });

    it('should abort if limit exceeded', async () => {
        const stream = Readable.from(['too ', 'large ', 'content']);
        await expect(ResponseLimiter.streamToString(stream, 5)).rejects.toThrow('Oversized response');
    });
});
