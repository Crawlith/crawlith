/* eslint-disable no-useless-assignment */
import { TransportDiagnostics, DnsDiagnostics, SecurityHeadersResult, PerformanceMetrics, AuditIssue } from './types.js';

interface CategoryScores {
  transport: number;
  security: number;
  performance: number;
  infrastructure: number;
}

export function calculateScore(
  transport: TransportDiagnostics,
  dns: DnsDiagnostics,
  headers: SecurityHeadersResult,
  performance: PerformanceMetrics,
  existingIssues: AuditIssue[]
): { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; issues: AuditIssue[]; categoryScores: CategoryScores } {

  const issues: AuditIssue[] = [...existingIssues];
  let transportScore = 0; // Max 30
  let securityScore = 0;  // Max 20
  let performanceScore = 0; // Max 30
  let infrastructureScore = 0; // Max 20

  // 1. Transport Security (30 pts)
  // TLS Version
  if (transport.tlsVersion) {
    const version = parseFloat(transport.tlsVersion.replace('v', '').replace('TLS', '').trim());
    if (version >= 1.2) {
      transportScore += 15;
    } else {
      issues.push({
        id: 'tls-old',
        severity: 'severe',
        category: 'tls',
        message: `Deprecated TLS version: ${transport.tlsVersion}`,
        scorePenalty: 15
      });
    }
  } else if (transport.certificate) {
    // HTTPS but no version detected? Unlikely.
  } else {
     // HTTP only?
     issues.push({
       id: 'no-https',
       severity: 'critical',
       category: 'tls',
       message: 'Site is not using HTTPS',
       scorePenalty: 30
     });
  }

  // Certificate
  if (transport.certificate) {
    if (transport.certificate.isValidChain && !transport.certificate.isSelfSigned) {
      transportScore += 15;
    } else {
      // Already caught in transport.ts, but let's ensure score reflects it
      // If issues has cert-invalid, we don't add points.
    }

    if (transport.certificate.daysUntilExpiry < 30 && transport.certificate.daysUntilExpiry >= 0) {
       issues.push({
         id: 'cert-expiring-soon',
         severity: 'moderate',
         category: 'tls',
         message: `Certificate expires in ${transport.certificate.daysUntilExpiry} days`,
         scorePenalty: 5
       });
       // Penalty applied to transport score logic implicitly by not reaching max,
       // but here we are adding up points.
       // Let's deduct from the 15 points we might have given.
       transportScore -= 5;
    } else if (transport.certificate.daysUntilExpiry < 0) {
       issues.push({
         id: 'cert-expired',
         severity: 'critical',
         category: 'tls',
         message: `Certificate expired on ${transport.certificate.validTo}`,
         scorePenalty: 30
       });
       transportScore = 0; // Reset transport score
    }
  }

  // 2. Response Security (Headers) (20 pts)
  // headers.score is 0-100. Map to 0-20.
  securityScore = (headers.score / 100) * 20;

  // Add issues for missing critical headers
  if (!headers.strictTransportSecurity.present) {
    issues.push({
      id: 'hsts-missing',
      severity: 'moderate',
      category: 'headers',
      message: 'Missing Strict-Transport-Security header',
      scorePenalty: 5
    });
  }
  if (!headers.contentSecurityPolicy.present) {
    issues.push({
        id: 'csp-missing',
        severity: 'moderate',
        category: 'headers',
        message: 'Missing Content-Security-Policy header',
        scorePenalty: 5
      });
  }

  // 3. Performance (30 pts)
  // HTTP/2 (5 pts)
  if (transport.alpnProtocol === 'h2' || transport.httpVersion === '2.0') {
    performanceScore += 5;
  } else {
    issues.push({
      id: 'no-h2',
      severity: 'minor',
      category: 'performance',
      message: 'HTTP/2 not supported',
      scorePenalty: 5
    });
  }

  // Compression (5 pts)
  if (transport.compression.length > 0) {
    performanceScore += 5;
  } else {
    issues.push({
      id: 'no-compression',
      severity: 'moderate',
      category: 'performance',
      message: 'No compression enabled (gzip/br)',
      scorePenalty: 5
    });
  }

  // TTFB (10 pts)
  if (performance.ttfb < 800) {
    performanceScore += 10;
  } else {
    issues.push({
      id: 'slow-ttfb',
      severity: 'moderate',
      category: 'performance',
      message: `Slow TTFB: ${performance.ttfb.toFixed(0)}ms`,
      scorePenalty: 10
    });
  }

  // Redirects (5 pts)
  if (transport.redirectCount <= 3) {
    performanceScore += 5;
  } else {
    issues.push({
      id: 'too-many-redirects',
      severity: 'moderate',
      category: 'performance',
      message: `Too many redirects: ${transport.redirectCount}`,
      scorePenalty: 5
    });
  }

  // HTML Size (5 pts)
  if (performance.htmlSize < 1024 * 1024) { // 1MB
    performanceScore += 5;
  } else {
     issues.push({
      id: 'large-html',
      severity: 'minor',
      category: 'performance',
      message: `HTML size > 1MB: ${(performance.htmlSize / 1024 / 1024).toFixed(2)}MB`,
      scorePenalty: 5
    });
  }

  // 4. Infrastructure (20 pts)
  // IPv6 (10 pts)
  if (dns.ipv6Support) {
    infrastructureScore += 10;
  } else {
    issues.push({
      id: 'no-ipv6',
      severity: 'minor',
      category: 'dns',
      message: 'No IPv6 DNS records found',
      scorePenalty: 5
    });
  }

  // Redundancy (10 pts)
  if (dns.ipCount > 1) {
    infrastructureScore += 10;
  } else {
    issues.push({
      id: 'single-ip',
      severity: 'minor',
      category: 'dns',
      message: 'Single IP address detected (no redundancy)',
      scorePenalty: 5
    });
  }

  let totalScore = transportScore + securityScore + performanceScore + infrastructureScore;

  // Critical Overrides
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    totalScore = Math.min(totalScore, 39); // Cap at F (<40)
  }

  const grade = getGrade(totalScore);

  return {
    score: Math.round(totalScore),
    grade,
    issues,
    categoryScores: {
        transport: transportScore,
        security: securityScore,
        performance: performanceScore,
        infrastructure: infrastructureScore
    }
  };
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
