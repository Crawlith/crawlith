import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedirectController } from '../src/core/network/redirectController.js';
import { Fetcher } from '../src/crawler/fetcher.js';
import { request } from 'undici';

vi.mock('undici', () => ({
    request: vi.fn(),
    ProxyAgent: vi.fn().mockImplementation(() => ({ dispatcher: {} }))
}));

describe('RedirectController', () => {
    it('should limit hops', () => {
        const ctrl = new RedirectController(2);
        expect(ctrl.nextHop('http://b.com')).toBe(null);
        expect(ctrl.nextHop('http://c.com')).toBe(null);
        expect(ctrl.nextHop('http://d.com')).toBe('redirect_limit_exceeded');
    });

    it('should detect loops', () => {
        const ctrl = new RedirectController(5);
        expect(ctrl.nextHop('http://b.com')).toBe(null);
        expect(ctrl.nextHop('http://a.com')).toBe(null);
        expect(ctrl.nextHop('http://b.com')).toBe('redirect_loop');
    });
});

describe('Fetcher Redirect Integration', () => {
    let fetcher: Fetcher;

    beforeEach(() => {
        vi.clearAllMocks();
        fetcher = new Fetcher({ rate: 100, maxRedirects: 2 });
    });

    it('should stop at max redirects', async () => {
        const mockRequest = vi.mocked(request);

        // Return 301 with unique locations
        mockRequest
            .mockResolvedValueOnce({
                statusCode: 301,
                headers: { location: 'http://a.com' },
                body: { dump: vi.fn().mockResolvedValue(undefined) }
            } as any)
            .mockResolvedValueOnce({
                statusCode: 301,
                headers: { location: 'http://b.com' },
                body: { dump: vi.fn().mockResolvedValue(undefined) }
            } as any)
            .mockResolvedValueOnce({
                statusCode: 301,
                headers: { location: 'http://c.com' },
                body: { dump: vi.fn().mockResolvedValue(undefined) }
            } as any);

        const res = await fetcher.fetch('http://start.com');
        expect(res.status).toBe('redirect_limit_exceeded');
        expect(res.redirectChain).toHaveLength(2);
    });

    it('should detect loops in fetch', async () => {
        const mockRequest = vi.mocked(request);

        mockRequest.mockResolvedValue({
            statusCode: 301,
            headers: { location: 'http://start.com' },
            body: { dump: vi.fn().mockResolvedValue(undefined) }
        } as any);

        const res = await fetcher.fetch('http://start.com');
        expect(res.status).toBe('redirect_loop');
    });
});
