import { resolveDns } from './dns.js';
import { analyzeTransport } from './transport.js';
import { analyzeHeaders } from './headers.js';
import { calculateScore } from './scoring.js';
import { AuditResult, AuditOptions } from './types.js';
import { URL } from 'node:url';
import { IPGuard } from '../core/security/ipGuard.js';

export async function auditUrl(urlStr: string, options: AuditOptions = {}): Promise<AuditResult> {
  const timeout = options.timeout || 10000;

  // 1. Basic URL validation
  let url: URL;
  try {
    url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols are supported');
    }
  } catch (error: any) {
    throw new Error(`Invalid URL: ${error.message}`, { cause: error });
  }

  // 2. SSRF Guard
  const isSafe = await IPGuard.validateHost(url.hostname);
  if (!isSafe) {
    throw new Error('Access to internal or private infrastructure is prohibited');
  }

  // 3. Parallelize DNS and Transport
  // We handle transport errors differently as they are fatal for the audit (e.g. connection refused)
  // DNS errors might return partial results but usually if transport works, DNS worked (unless transport used IP)

  const dnsPromise = resolveDns(url.hostname);
  const transportPromise = analyzeTransport(urlStr, timeout);

  const [dnsResult, transportResult] = await Promise.all([
    dnsPromise,
    transportPromise
  ]);

  // 3. Analyze Headers
  const headersResult = analyzeHeaders(transportResult.transport.headers);

  // 4. Calculate Score
  const scoringResult = calculateScore(
    transportResult.transport,
    dnsResult,
    headersResult,
    transportResult.performance,
    transportResult.issues
  );

  // 5. Build Result
  const result: AuditResult = {
    url: urlStr,
    transport: transportResult.transport,
    securityHeaders: headersResult,
    dns: dnsResult,
    performance: transportResult.performance,
    score: scoringResult.score,
    grade: scoringResult.grade,
    issues: scoringResult.issues
  };

  return result;
}
