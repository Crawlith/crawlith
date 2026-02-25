import { SecurityHeadersResult, HeaderStatus } from './types.js';

export function analyzeHeaders(headers: Record<string, string | string[] | undefined>): SecurityHeadersResult {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.join(', ');
    }
  }

  const result: SecurityHeadersResult = {
    strictTransportSecurity: checkHSTS(normalized['strict-transport-security']),
    contentSecurityPolicy: checkCSP(normalized['content-security-policy']),
    xFrameOptions: checkXFrameOptions(normalized['x-frame-options']),
    xContentTypeOptions: checkXContentTypeOptions(normalized['x-content-type-options']),
    referrerPolicy: checkReferrerPolicy(normalized['referrer-policy']),
    permissionsPolicy: checkPermissionsPolicy(normalized['permissions-policy']),
    details: normalized,
    score: 0
  };

  // Calculate internal score (0-100) based on presence and validity
  let score = 0;
  const weights = {
    hsts: 30,
    csp: 25,
    xframe: 15,
    xcontent: 15,
    referrer: 10,
    permissions: 5
  };

  if (result.strictTransportSecurity.valid) score += weights.hsts;
  if (result.contentSecurityPolicy.valid) score += weights.csp;
  if (result.xFrameOptions.valid) score += weights.xframe;
  if (result.xContentTypeOptions.valid) score += weights.xcontent;
  if (result.referrerPolicy.valid) score += weights.referrer;
  if (result.permissionsPolicy.valid) score += weights.permissions;

  result.score = score;

  return result;
}

function checkHSTS(value: string | undefined): HeaderStatus {
  if (!value) return { present: false, value: null, valid: false, issues: ['Missing HSTS header'] };

  const valid = value.includes('max-age=');
  const issues: string[] = [];
  if (!valid) issues.push('Missing max-age directive');
  if (!value.includes('includeSubDomains')) issues.push('Missing includeSubDomains');

  return { present: true, value, valid, issues };
}

function checkCSP(value: string | undefined): HeaderStatus {
  if (!value) return { present: false, value: null, valid: false, issues: ['Missing CSP header'] };

  // Basic check: non-empty
  return { present: true, value, valid: value.length > 0, issues: [] };
}

function checkXFrameOptions(value: string | undefined): HeaderStatus {
  if (!value) return { present: false, value: null, valid: false, issues: ['Missing X-Frame-Options'] };

  const upper = value.toUpperCase();
  const valid = upper === 'DENY' || upper === 'SAMEORIGIN';
  return {
    present: true,
    value,
    valid,
    issues: valid ? [] : [`Invalid value: ${value}`]
  };
}

function checkXContentTypeOptions(value: string | undefined): HeaderStatus {
  if (!value) return { present: false, value: null, valid: false, issues: ['Missing X-Content-Type-Options'] };

  const valid = value.toLowerCase() === 'nosniff';
  return {
    present: true,
    value,
    valid,
    issues: valid ? [] : [`Invalid value: ${value}`]
  };
}

function checkReferrerPolicy(value: string | undefined): HeaderStatus {
  if (!value) return { present: false, value: null, valid: false, issues: ['Missing Referrer-Policy'] };
  return { present: true, value, valid: true, issues: [] };
}

function checkPermissionsPolicy(value: string | undefined): HeaderStatus {
  if (!value) return { present: false, value: null, valid: false, issues: ['Missing Permissions-Policy'] };
  return { present: true, value, valid: true, issues: [] };
}
