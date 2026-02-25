import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fetcher } from '../src/crawler/fetcher.js';
import { request } from 'undici';

vi.mock('undici', () => ({
    request: vi.fn(),
}));

describe('Fetcher Safety Integration', () => {
    let fetcher: Fetcher;

    beforeEach(() => {
        vi.clearAllMocks();
        fetcher = new Fetcher({ rate: 100 }); // High rate for tests
    });

    it('should block internal IPs', async () => {
        const res = await fetcher.fetch('http://127.0.0.1');
        expect(res.status).toBe('blocked_internal_ip');
    });

    it('should block internal IPs in redirects', async () => {
        const mockRequest = vi.mocked(request);

        // First request is fine, returns redirect
        mockRequest.mockResolvedValueOnce({
            statusCode: 301,
            headers: { location: 'http://192.168.1.1' },
            body: { dump: vi.fn(), text: vi.fn().mockResolvedValue('') }
        } as any);

        const res = await fetcher.fetch('http://example.com');
        expect(res.status).toBe('blocked_internal_ip');
        expect(res.redirectChain).toHaveLength(1); // Records the redirect that led to block
        expect(res.redirectChain[0].target).toBe('http://192.168.1.1/');
    });

    it('should enforce max bytes', async () => {
        const mockRequest = vi.mocked(request);

        mockRequest.mockResolvedValueOnce({
            statusCode: 200,
            headers: {},
            body: {
                on: vi.fn((event, cb) => {
                    if (event === 'data') {
                        cb(Buffer.alloc(1000));
                        cb(Buffer.alloc(1000));
                    }
                    return { on: vi.fn() };
                }),
                destroy: vi.fn(),
                dump: vi.fn()
            }
        } as any);

        const res = await fetcher.fetch('http://example.com', { maxBytes: 500 });
        expect(res.status).toBe('oversized');
    });

    it('should retry on 500', async () => {
        const mockRequest = vi.mocked(request);

        mockRequest
            .mockResolvedValueOnce({
                statusCode: 500,
                headers: {},
                body: { dump: vi.fn().mockResolvedValue(undefined) }
            } as any)
            .mockResolvedValueOnce({
                statusCode: 200,
                headers: {},
                body: {
                    on: vi.fn((event, cb) => {
                        if (event === 'data') cb(Buffer.from('ok'));
                        if (event === 'end') cb();
                    })
                }
            } as any);

        const res = await fetcher.fetch('http://example.com');
        expect(res.status).toBe(200);
        expect(res.retries).toBe(1);
    });
});
