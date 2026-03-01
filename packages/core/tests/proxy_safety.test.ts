import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fetcher } from '../src/crawler/fetcher.js';
import { request, ProxyAgent } from 'undici';

vi.mock('undici', async (importOriginal) => {
    const original = await importOriginal<typeof import('undici')>();
    return {
        ...original,
        request: vi.fn(),
        ProxyAgent: vi.fn(function () {
            return {
                request: vi.fn(),
                close: vi.fn()
            };
        })
    };
});

describe('Proxy Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should use ProxyAgent when proxyUrl is provided', async () => {
        const fetcher = new Fetcher({ proxyUrl: 'http://proxy.com:8080', rate: 100 });
        const mockRequest = vi.mocked(request);

        // Mock the request to return a successful response immediately
        mockRequest.mockResolvedValueOnce({
            statusCode: 200,
            headers: {},
            body: {
                on: vi.fn((event, cb) => {
                    if (event === 'data') {
                        // Simulate async data chunk
                        setTimeout(() => cb(Buffer.from('ok')), 0);
                    }
                    if (event === 'end') {
                        // Simulate async end
                        setTimeout(() => cb(), 0);
                    }
                    return { on: vi.fn() }; // chaining
                }),
                dump: vi.fn(),
                text: vi.fn().mockResolvedValue('ok')
            }
        } as any);

        await fetcher.fetch('http://target.com');

        expect(ProxyAgent).toHaveBeenCalledWith('http://proxy.com:8080');
    });

    it('should fail fast on invalid proxy URL', () => {
        expect(() => new Fetcher({ proxyUrl: 'not-a-url' })).toThrow('Invalid proxy URL');
    });
});
