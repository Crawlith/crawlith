import { describe, it, expect } from 'vitest';
import { calculateScore } from '../../src/audit/scoring.js';
import { TransportDiagnostics, DnsDiagnostics, SecurityHeadersResult, PerformanceMetrics, AuditIssue } from '../../src/audit/types.js';

describe('Scoring Engine', () => {
  const mockTransport: TransportDiagnostics = {
    tlsVersion: 'TLSv1.3',
    cipherSuite: 'TLS_AES_256_GCM_SHA384',
    alpnProtocol: 'h2',
    certificate: {
      issuer: 'Let\'s Encrypt',
      subject: 'example.com',
      validFrom: '2023-01-01',
      validTo: '2024-01-01',
      daysUntilExpiry: 60,
      isSelfSigned: false,
      isValidChain: true,
      fingerprint: 'SHA256:...'
    } as any,
    httpVersion: '2.0',
    compression: ['gzip'],
    keepAlive: true,
    transferEncoding: null,
    redirectCount: 0,
    redirects: [],
    serverHeader: 'nginx',
    headers: {}
  };

  const mockDns: DnsDiagnostics = {
    a: ['1.1.1.1', '1.0.0.1'],
    aaaa: ['2606:4700:4700::1111'],
    cname: [],
    reverse: [],
    ipCount: 3,
    ipv6Support: true,
    resolutionTime: 10
  };

  const mockHeaders: SecurityHeadersResult = {
    strictTransportSecurity: { present: true, valid: true, value: 'max-age=31536000' },
    contentSecurityPolicy: { present: true, valid: true, value: "default-src 'self'" },
    xFrameOptions: { present: true, valid: true, value: 'DENY' },
    xContentTypeOptions: { present: true, valid: true, value: 'nosniff' },
    referrerPolicy: { present: true, valid: true, value: 'strict-origin' },
    permissionsPolicy: { present: true, valid: true, value: 'geolocation=()' },
    details: {},
    score: 100
  };

  const mockPerformance: PerformanceMetrics = {
    dnsLookupTime: 10,
    tcpConnectTime: 20,
    tlsHandshakeTime: 30,
    ttfb: 100,
    totalTime: 200,
    htmlSize: 50000,
    headerSize: 500,
    redirectTime: 0
  };

  it('should give perfect score for perfect inputs', () => {
    const result = calculateScore(mockTransport, mockDns, mockHeaders, mockPerformance, []);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.issues).toHaveLength(0);
  });

  it('should penalize TLS < 1.2', () => {
    const badTransport = { ...mockTransport, tlsVersion: 'TLSv1.1' };
    const result = calculateScore(badTransport, mockDns, mockHeaders, mockPerformance, []);
    expect(result.score).toBeLessThan(100);
    expect(result.categoryScores.transport).toBeLessThan(30);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'tls-old' })]));
  });

  it('should penalize missing HTTPS', () => {
    const badTransport = { ...mockTransport, tlsVersion: null, certificate: null };
    const result = calculateScore(badTransport, mockDns, mockHeaders, mockPerformance, []);
    expect(result.score).toBeLessThan(50); // Critical
    expect(result.grade).toBe('F');
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'no-https' })]));
  });

  it('should fail on expired cert', () => {
    const expiredTransport = {
        ...mockTransport,
        certificate: { ...mockTransport.certificate!, daysUntilExpiry: -5, validTo: '2023-01-01' }
    };
    const result = calculateScore(expiredTransport, mockDns, mockHeaders, mockPerformance, []);
    expect(result.grade).toBe('F');
    expect(result.score).toBeLessThanOrEqual(40);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'cert-expired' })]));
  });

  it('should penalize missing security headers', () => {
    // If score is 50, it means we lost 50 points in headers category (internal score)
    // headers category is 20 points total. So we lose 10 points.
    const badHeaders = { ...mockHeaders, score: 50, strictTransportSecurity: { present: false, valid: false, value: null } };
    const result = calculateScore(mockTransport, mockDns, badHeaders, mockPerformance, []);
    expect(result.categoryScores.security).toBe(10);
    expect(result.score).toBe(90); // 100 - 10
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'hsts-missing' })]));
  });

  it('should penalize poor performance', () => {
      const badPerf = { ...mockPerformance, ttfb: 1000, htmlSize: 2000000 };
      const result = calculateScore(mockTransport, mockDns, mockHeaders, badPerf, []);
      // TTFB > 800: Lose 10 pts
      // HTML > 1MB: Lose 5 pts
      // Total perf score (30) -> 15.
      expect(result.categoryScores.performance).toBe(15);
      expect(result.score).toBe(85);
      expect(result.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: 'slow-ttfb' }),
          expect.objectContaining({ id: 'large-html' })
      ]));
  });

  it('should penalize infrastructure issues', () => {
      const badDns = { ...mockDns, ipv6Support: false, ipCount: 1 };
      const result = calculateScore(mockTransport, badDns, mockHeaders, mockPerformance, []);
      // No IPv6: Lose 10 pts
      // Single IP: Lose 10 pts
      // Infra score (20) -> 0.
      expect(result.categoryScores.infrastructure).toBe(0);
      expect(result.score).toBe(80);
      expect(result.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: 'no-ipv6' }),
          expect.objectContaining({ id: 'single-ip' })
      ]));
  });
});
