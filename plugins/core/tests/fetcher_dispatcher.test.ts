import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fetcher } from '../src/crawler/fetcher.js';
import { request } from 'undici';

// Hoist the mock dispatcher so it's available in the mock factory
const { mockDispatcher } = vi.hoisted(() => {
    return { mockDispatcher: { dispatch: vi.fn() } };
});

// Mock undici
vi.mock('undici', () => {
    return {
        request: vi.fn(),
        Agent: class {
            dispatch = vi.fn();
        },
        Dispatcher: class {}
    };
});

// Mock IPGuard to bypass the initial check for domains
vi.mock('../src/core/security/ipGuard.js', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        IPGuard: {
            ...actual.IPGuard,
            validateHost: vi.fn().mockResolvedValue(true), // Bypass initial check
            getSecureDispatcher: vi.fn().mockReturnValue(mockDispatcher)
        }
    };
});

describe('SSRF Fix Reproduction', () => {
    let fetcher: Fetcher;

    beforeEach(() => {
        vi.clearAllMocks();
        fetcher = new Fetcher();
    });

    it('should return blocked_internal_ip when secureDispatcher blocks an IP', async () => {
        const mockRequest = vi.mocked(request);

        // Simulate secureDispatcher throwing EBLOCKED
        const blockedError = new Error('Blocked internal IP: 127.0.0.1');
        (blockedError as any).code = 'EBLOCKED';
        mockRequest.mockRejectedValue(blockedError);

        const res = await fetcher.fetch('http://example.com');

        // Should return blocked_internal_ip now
        expect(res.status).toBe('blocked_internal_ip');

        // Verify that the secure dispatcher was actually passed to the request
        expect(mockRequest).toHaveBeenCalledWith(
            expect.stringContaining('http://example.com'),
            expect.objectContaining({
                dispatcher: mockDispatcher
            })
        );
    });
});
