import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fetcher } from '../src/crawler/fetcher.js';
import { request } from 'undici';
import { IPGuard } from '../src/core/security/ipGuard.js';

// Mock undici request to fail with EBLOCKED
vi.mock('undici', () => {
    return {
        request: vi.fn(),
        Agent: class {
            dispatch = vi.fn();
        },
        Dispatcher: class {}
    };
});

// Mock IPGuard.validateHost to pass
vi.mock('../src/core/security/ipGuard.js', async () => {
    const original = await vi.importActual('../src/core/security/ipGuard.js');
    return {
        ...original as any,
        IPGuard: {
            ...original.IPGuard,
            validateHost: vi.fn().mockResolvedValue(true), // Pass step 1
            getSecureDispatcher: vi.fn()
        }
    };
});

describe('SSRF Fix Reproduction', () => {
    let fetcher: Fetcher;

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mock return for dispatcher
        vi.mocked(IPGuard.getSecureDispatcher).mockReturnValue({} as any);
        fetcher = new Fetcher({ rate: 100 });
    });

    it('should return blocked_internal_ip when secureDispatcher blocks', async () => {
        const mockRequest = vi.mocked(request);
        const mockGetSecureDispatcher = vi.mocked(IPGuard.getSecureDispatcher);
        const mockDispatcher = { dispatch: vi.fn() } as any;
        mockGetSecureDispatcher.mockReturnValue(mockDispatcher);

        // Re-initialize fetcher so it calls getSecureDispatcher and gets our specific mock
        fetcher = new Fetcher({ rate: 100 });

        // Simulate secureDispatcher blocking via undici request throwing EBLOCKED
        const blockedError = new Error('Blocked internal IP: 127.0.0.1');
        (blockedError as any).code = 'EBLOCKED';

        mockRequest.mockRejectedValueOnce(blockedError);

        const res = await fetcher.fetch('http://example.com');

        // Now we expect correct handling
        expect(res.status).toBe('blocked_internal_ip');

        // Verify that the secure dispatcher was indeed used
        expect(mockGetSecureDispatcher).toHaveBeenCalled();
        expect(mockRequest).toHaveBeenCalledWith(
            expect.stringContaining('http://example.com'),
            expect.objectContaining({
                dispatcher: mockDispatcher
            })
        );
    });
});
