import { describe, expect, test } from 'vitest';
import { renderAuditOutput } from '../src/commands/auditFormatter.js';
import { AuditResult } from '@crawlith/core';

function createMockAuditResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    url: 'https://example.com',
    score: 95,
    grade: 'A',
    transport: {
      tlsVersion: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      alpnProtocol: 'h2',
      certificate: {
        issuer: 'Let\'s Encrypt',
        subject: 'example.com',
        validFrom: '2023-01-01',
        validTo: '2024-01-01',
        daysUntilExpiry: 45,
        isSelfSigned: false,
        isValidChain: true,
        fingerprint: 'XX:XX:XX:XX',
        serialNumber: '1234567890'
      },
      httpVersion: '2.0',
      compression: ['gzip'],
      keepAlive: true,
      transferEncoding: null,
      redirectCount: 0,
      redirects: [],
      serverHeader: 'nginx',
      headers: {
        'server': 'nginx',
        'content-type': 'text/html'
      }
    },
    securityHeaders: {
      strictTransportSecurity: { present: true, valid: true, value: 'max-age=31536000' },
      contentSecurityPolicy: { present: false, valid: false, value: null },
      xFrameOptions: { present: true, valid: true, value: 'DENY' },
      xContentTypeOptions: { present: true, valid: true, value: 'nosniff' },
      referrerPolicy: { present: true, valid: true, value: 'strict-origin-when-cross-origin' },
      permissionsPolicy: { present: false, valid: false, value: null },
      details: {},
      score: 80
    },
    dns: {
      a: ['192.0.2.1'],
      aaaa: ['2001:db8::1'],
      cname: [],
      reverse: ['server.example.com'],
      ipCount: 2,
      ipv6Support: true,
      resolutionTime: 10
    },
    performance: {
      dnsLookupTime: 10,
      tcpConnectTime: 20,
      tlsHandshakeTime: 30,
      ttfb: 100,
      totalTime: 500,
      htmlSize: 50000,
      headerSize: 1000
    },
    issues: [],
    ...overrides
  };
}

describe('audit formatter', () => {
  test('renders basic audit output', () => {
    const result = createMockAuditResult();
    const output = renderAuditOutput(result, false, false);

    expect(output).toContain('Audit Report for: https://example.com');
    expect(output).toContain('Overall Grade:');
    expect(output).toContain('Score: 95/100');
    expect(output).toContain('Transport & Security');
    expect(output).toContain('TLS Version:');
    expect(output).toContain('TLSv1.3');
    expect(output).toContain('Security Headers');
    expect(output).toContain('HSTS');
    expect(output).toContain('Performance Metrics');
    expect(output).toContain('Infrastructure');
    expect(output).toContain('No significant issues found.');

    // Check that verbose/debug info is NOT present
    expect(output).not.toContain('Valid From:');
    expect(output).not.toContain('Reverse DNS:');
    expect(output).not.toContain('DEBUG INFO');
  });

  test('renders audit output with issues', () => {
    const result = createMockAuditResult({
      issues: [
        {
          id: 'test-issue',
          severity: 'critical',
          category: 'tls',
          message: 'TLS is broken',
          scorePenalty: 20
        },
        {
          id: 'test-issue-2',
          severity: 'moderate',
          category: 'headers',
          message: 'Missing header',
          scorePenalty: 5
        }
      ]
    });
    const output = renderAuditOutput(result, false, false);

    expect(output).toContain('Issues Found');
    expect(output).toContain('[CRITICAL]');
    expect(output).toContain('TLS is broken');
    expect(output).toContain('(-20)');
    expect(output).toContain('[MODERATE]');
    expect(output).toContain('Missing header');
    expect(output).toContain('(-5)');
    expect(output).not.toContain('No significant issues found.');
  });

  test('renders audit output with verbose flag', () => {
    const result = createMockAuditResult();
    const output = renderAuditOutput(result, true, false);

    // Verbose prints extra cert details
    expect(output).toContain('Valid From:');
    expect(output).toContain('Valid To:');
    expect(output).toContain('Subject:');
    expect(output).toContain('Fingerprint:');

    // Verbose prints reverse DNS if available
    expect(output).toContain('Reverse DNS:     server.example.com');

    expect(output).not.toContain('DEBUG INFO');
  });

  test('renders audit output with debug flag', () => {
    const result = createMockAuditResult({
      transport: {
        ...createMockAuditResult().transport,
        redirects: [
          { url: 'http://example.com', statusCode: 301, location: 'https://example.com' }
        ]
      }
    });
    const output = renderAuditOutput(result, false, true);

    // Debug prints debug info block
    expect(output).toContain('DEBUG INFO');
    expect(output).toContain('Redirect Chain:');
    expect(output).toContain('301 -> https://example.com');
    expect(output).toContain('Response Headers:');
    expect(output).toContain('server: nginx');
    expect(output).toContain('content-type: text/html');
  });

  test('formats certificate days until expiry color correctly based on days', () => {
    const resultOk = createMockAuditResult({
      transport: {
        ...createMockAuditResult().transport,
        certificate: { ...createMockAuditResult().transport.certificate!, daysUntilExpiry: 95 }
      }
    });
    const outputOk = renderAuditOutput(resultOk, false, false);
    expect(outputOk).toContain('Expires in');

    const resultWarn = createMockAuditResult({
      transport: {
        ...createMockAuditResult().transport,
        certificate: { ...createMockAuditResult().transport.certificate!, daysUntilExpiry: 45 }
      }
    });
    const outputWarn = renderAuditOutput(resultWarn, false, false);
    expect(outputWarn).toContain('Expires in');

    const resultCrit = createMockAuditResult({
      transport: {
        ...createMockAuditResult().transport,
        certificate: { ...createMockAuditResult().transport.certificate!, daysUntilExpiry: 15 }
      }
    });
    const outputCrit = renderAuditOutput(resultCrit, false, false);
    expect(outputCrit).toContain('Expires in');
  });
});