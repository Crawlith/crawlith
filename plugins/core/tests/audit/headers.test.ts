import { describe, it, expect } from 'vitest';
import { analyzeHeaders } from '../../src/audit/headers.js';

describe('Headers Analysis', () => {
  it('should detect all secure headers', () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'content-security-policy': "default-src 'self'",
      'x-frame-options': 'DENY',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'geolocation=()'
    };
    const result = analyzeHeaders(headers);
    expect(result.score).toBe(100);
    expect(result.strictTransportSecurity.valid).toBe(true);
  });

  it('should handle missing headers', () => {
    const headers = {};
    const result = analyzeHeaders(headers);
    expect(result.score).toBe(0);
    expect(result.strictTransportSecurity.present).toBe(false);
  });

  it('should validate HSTS properly', () => {
    const headers = {
      'strict-transport-security': 'max-age=0'
    };
    // valid requires max-age
    const result = analyzeHeaders(headers);
    expect(result.strictTransportSecurity.valid).toBe(true);
    // Wait, checkHSTS: includes('max-age=') is true. includes('includeSubDomains') is false.
    // Issues will contain 'Missing includeSubDomains'.
    expect(result.strictTransportSecurity.issues).toContain('Missing includeSubDomains');
  });

  it('should validate invalid HSTS', () => {
    const headers = {
      'strict-transport-security': 'invalid'
    };
    const result = analyzeHeaders(headers);
    expect(result.strictTransportSecurity.valid).toBe(false);
  });
});
