import chalk from '../utils/chalk.js';
import { AuditResult } from '@crawlith/core';

export function renderAuditOutput(result: AuditResult, verbose: boolean, debug: boolean): string {
  const lines: string[] = [];

  // Header
  lines.push(chalk.bold.blue(`\nAudit Report for: ${result.url}`));
  lines.push(chalk.gray('--------------------------------------------------'));

  // Score & Grade
  const gradeColor = getGradeColor(result.grade);
  lines.push(`Overall Grade: ${gradeColor(result.grade)}  (Score: ${result.score}/100)`);
  lines.push('');

  // Transport & TLS
  lines.push(chalk.bold.yellow('Transport & Security'));
  const t = result.transport;
  lines.push(`  TLS Version:     ${t.tlsVersion ? chalk.green(t.tlsVersion) : chalk.red('None')}`);
  lines.push(`  Cipher Suite:    ${t.cipherSuite || 'N/A'}`);
  lines.push(`  HTTP Version:    ${t.httpVersion}`);
  if (t.certificate) {
    const cert = t.certificate;
    const daysColor = cert.daysUntilExpiry < 30 ? chalk.red : (cert.daysUntilExpiry < 90 ? chalk.yellow : chalk.green);
    lines.push(`  Certificate:     ${cert.issuer} (Expires in ${daysColor(cert.daysUntilExpiry + ' days')})`);
    if (verbose) {
      lines.push(`    Valid From:    ${cert.validFrom}`);
      lines.push(`    Valid To:      ${cert.validTo}`);
      lines.push(`    Subject:       ${cert.subject}`);
      lines.push(`    Fingerprint:   ${cert.fingerprint}`);
    }
  }
  lines.push('');

  // Security Headers
  lines.push(chalk.bold.yellow('Security Headers'));
  const h = result.securityHeaders;
  renderHeaderRow(lines, 'HSTS', h.strictTransportSecurity);
  renderHeaderRow(lines, 'CSP', h.contentSecurityPolicy);
  renderHeaderRow(lines, 'X-Frame', h.xFrameOptions);
  renderHeaderRow(lines, 'X-Content', h.xContentTypeOptions);
  renderHeaderRow(lines, 'Referrer', h.referrerPolicy);
  renderHeaderRow(lines, 'Permissions', h.permissionsPolicy);
  lines.push('');

  // Performance
  lines.push(chalk.bold.yellow('Performance Metrics'));
  const p = result.performance;
  lines.push(`  TTFB:            ${formatTime(p.ttfb, 800)}`);
  lines.push(`  Total Time:      ${formatTime(p.totalTime, 2000)}`);
  lines.push(`  DNS Lookup:      ${p.dnsLookupTime.toFixed(0)}ms`);
  lines.push(`  TCP Connect:     ${p.tcpConnectTime.toFixed(0)}ms`);
  lines.push(`  TLS Handshake:   ${p.tlsHandshakeTime.toFixed(0)}ms`);
  lines.push(`  HTML Size:       ${(p.htmlSize / 1024).toFixed(2)} KB`);
  lines.push(`  Redirects:       ${t.redirectCount}`);
  lines.push('');

  // Infrastructure
  lines.push(chalk.bold.yellow('Infrastructure'));
  const d = result.dns;
  lines.push(`  IP Addresses:    ${d.ipCount} ${d.ipCount > 1 ? chalk.green('(Redundant)') : chalk.yellow('(Single)')}`);
  lines.push(`  IPv6 Support:    ${d.ipv6Support ? chalk.green('Yes') : chalk.red('No')}`);
  if (verbose && d.reverse.length > 0) {
    lines.push(`  Reverse DNS:     ${d.reverse.join(', ')}`);
  }
  lines.push('');

  // Issues
  if (result.issues.length > 0) {
    lines.push(chalk.bold.red('Issues Found'));
    for (const issue of result.issues) {
      const severityColor = getSeverityColor(issue.severity);
      lines.push(`  [${severityColor(issue.severity.toUpperCase())}] ${issue.message} ${chalk.gray(`(-${issue.scorePenalty})`)}`);
    }
    lines.push('');
  } else {
    lines.push(chalk.green('No significant issues found.'));
    lines.push('');
  }

  // Debug Output
  if (debug) {
    lines.push(chalk.gray('--------------------------------------------------'));
    lines.push(chalk.bold.magenta('DEBUG INFO'));
    lines.push('Redirect Chain:');
    t.redirects.forEach((r: any, i: number) => {
      lines.push(`  ${i + 1}. ${r.statusCode} -> ${r.location}`);
    });
    lines.push('');
    lines.push('Response Headers:');
    for (const [key, value] of Object.entries(t.headers)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

function getGradeColor(grade: string) {
  switch (grade) {
    case 'A': return chalk.green.bold;
    case 'B': return chalk.cyan.bold;
    case 'C': return chalk.yellow.bold;
    case 'D': return chalk.red.bold;
    case 'F': return chalk.bgRed.white.bold;
    default: return chalk.white;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return chalk.red.bold;
    case 'severe': return chalk.red;
    case 'moderate': return chalk.yellow;
    case 'minor': return chalk.cyan;
    default: return chalk.gray;
  }
}

function formatTime(ms: number, threshold: number): string {
  const val = `${ms.toFixed(0)}ms`;
  return ms > threshold ? chalk.red(val) : chalk.green(val);
}

function renderHeaderRow(lines: string[], label: string, status: { present: boolean, valid: boolean, value: string | null }) {
  const icon = status.present ? (status.valid ? chalk.green('✔') : chalk.yellow('⚠')) : chalk.red('✖');
  const value = status.value ? (status.value.length > 40 ? status.value.substring(0, 37) + '...' : status.value) : '';
  lines.push(`  ${label.padEnd(12)} ${icon} ${chalk.gray(value)}`);
}
