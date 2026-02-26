import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { auditUrl } from '../../src/audit/index.js';
import { resolveDns } from '../../src/audit/dns.js';
import { analyzeTransport } from '../../src/audit/transport.js';
import { analyzeHeaders } from '../../src/audit/headers.js';
import { calculateScore } from '../../src/audit/scoring.js';
import { IPGuard } from '../../src/core/security/ipGuard.js';

// Mock dependencies
vi.mock('../../src/audit/dns.js', () => ({
  resolveDns: vi.fn(),
}));
vi.mock('../../src/audit/transport.js', () => ({
  analyzeTransport: vi.fn(),
}));
vi.mock('../../src/audit/headers.js', () => ({
  analyzeHeaders: vi.fn(),
}));
vi.mock('../../src/audit/scoring.js', () => ({
  calculateScore: vi.fn(),
}));
vi.mock('../../src/core/security/ipGuard.js', () => ({
  IPGuard: {
    validateHost: vi.fn(),
  },
}));

describe('auditUrl', () => {
  const mockUrl = 'https://example.com';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully audit a valid URL', async () => {
    // Setup mocks
    vi.mocked(IPGuard.validateHost).mockResolvedValue(true);

    const mockDnsResult = { ip: '1.2.3.4' };
    vi.mocked(resolveDns).mockResolvedValue(mockDnsResult as any);

    const mockTransportResult = {
      transport: { headers: {} },
      performance: { loadTime: 100 },
      issues: [],
    };
    vi.mocked(analyzeTransport).mockResolvedValue(mockTransportResult as any);

    const mockHeadersResult = { grade: 'A' };
    vi.mocked(analyzeHeaders).mockReturnValue(mockHeadersResult as any);

    const mockScoringResult = {
      score: 95,
      grade: 'A',
      issues: [],
    };
    vi.mocked(calculateScore).mockReturnValue(mockScoringResult as any);

    // Execute
    const result = await auditUrl(mockUrl);

    // Verify
    expect(IPGuard.validateHost).toHaveBeenCalledWith('example.com');
    expect(resolveDns).toHaveBeenCalledWith('example.com');
    expect(analyzeTransport).toHaveBeenCalledWith(mockUrl, 10000); // default timeout
    expect(analyzeHeaders).toHaveBeenCalledWith(mockTransportResult.transport.headers);
    expect(calculateScore).toHaveBeenCalled();

    expect(result).toEqual({
      url: mockUrl,
      transport: mockTransportResult.transport,
      securityHeaders: mockHeadersResult,
      dns: mockDnsResult,
      performance: mockTransportResult.performance,
      score: mockScoringResult.score,
      grade: mockScoringResult.grade,
      issues: mockScoringResult.issues,
    });
  });

  it('should throw error for invalid URL protocol', async () => {
    await expect(auditUrl('ftp://example.com')).rejects.toThrow('Only HTTP and HTTPS protocols are supported');
  });

  it('should throw error for malformed URL', async () => {
    await expect(auditUrl('not-a-url')).rejects.toThrow('Invalid URL');
  });

  it('should throw error if SSRF check fails', async () => {
    vi.mocked(IPGuard.validateHost).mockResolvedValue(false);
    await expect(auditUrl(mockUrl)).rejects.toThrow('Access to internal or private infrastructure is prohibited');
  });

  it('should propagate errors from dependencies', async () => {
    vi.mocked(IPGuard.validateHost).mockResolvedValue(true);
    vi.mocked(resolveDns).mockRejectedValue(new Error('DNS Error'));
    vi.mocked(analyzeTransport).mockResolvedValue({} as any); // Should resolve if DNS fails? Wait, Promise.all fails if any fails.

    await expect(auditUrl(mockUrl)).rejects.toThrow('DNS Error');
  });
});
