import https from 'node:https';
import http from 'node:http';
import tls from 'node:tls';
import { URL } from 'node:url';
import { IPGuard } from '../core/security/ipGuard.js';
import { TransportDiagnostics, PerformanceMetrics, CertificateInfo, RedirectInfo, AuditIssue } from './types.js';
import { IncomingMessage } from 'node:http';

interface RequestResult {
  url: string;
  response: IncomingMessage;
  body: Buffer;
  timings: {
    dns: number;
    tcp: number;
    tls: number;
    ttfb: number;
    total: number;
  };
  socket: any;
  redirectUrl: string | null;
}

export async function analyzeTransport(targetUrl: string, timeout: number): Promise<{
  transport: TransportDiagnostics;
  performance: PerformanceMetrics;
  issues: AuditIssue[];
}> {
  const maxRedirects = 10;
  let currentUrl = targetUrl;
  let redirectCount = 0;
  const redirects: RedirectInfo[] = [];
  const issues: AuditIssue[] = [];

  // Cumulative metrics
  let totalRedirectTime = 0;

  for (let i = 0; i < maxRedirects; i++) {
    const urlObj = new URL(currentUrl);
    const isSafe = await IPGuard.validateHost(urlObj.hostname);
    if (!isSafe) {
      throw new Error(`Blocked: Redirect to internal/private IP prohibited (${currentUrl})`);
    }

    try {
      const result = await executeRequest(currentUrl, timeout);

      if (result.redirectUrl) {
        redirectCount++;
        totalRedirectTime += result.timings.total;

        redirects.push({
          url: currentUrl,
          statusCode: result.response.statusCode || 0,
          location: result.redirectUrl
        });

        currentUrl = result.redirectUrl;
        continue;
      }

      // Final destination reached
      const { response, body, timings, socket } = result;

      // Collect Certificate Info
      let certInfo: CertificateInfo | null = null;
      let tlsVersion: string | null = null;
      let cipherSuite: string | null = null;
      let alpnProtocol: string | null = null;

      if (socket instanceof tls.TLSSocket) {
        const cert = socket.getPeerCertificate(true);
        tlsVersion = socket.getProtocol();
        const cipher = socket.getCipher();
        cipherSuite = cipher ? cipher.name : null;
        alpnProtocol = socket.alpnProtocol || null;

        if (cert && Object.keys(cert).length > 0) {
          certInfo = {
            subject: (cert.subject && cert.subject.CN) ? cert.subject.CN : 'Unknown',
            issuer: (cert.issuer && cert.issuer.CN) ? cert.issuer.CN : 'Unknown',
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            daysUntilExpiry: Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            isSelfSigned: cert.issuer && cert.subject && cert.issuer.CN === cert.subject.CN,
            isValidChain: socket.authorized,
            fingerprint: cert.fingerprint,
            serialNumber: cert.serialNumber,
            subjectAltName: cert.subjectaltname
          };

          if (!socket.authorized) {
            issues.push({
              id: 'cert-invalid',
              severity: 'severe',
              category: 'tls',
              message: `Certificate validation failed: ${socket.authorizationError}`,
              scorePenalty: 30
            });
          }
        }
      }

      const httpVersion = response.httpVersion;
      const contentEncoding = response.headers['content-encoding'];
      const compression: string[] = [];
      if (contentEncoding) {
        compression.push(contentEncoding);
      }

      const connectionHeader = response.headers['connection'];
      const keepAlive = connectionHeader ? connectionHeader.toLowerCase() !== 'close' : true;
      const serverHeader = (response.headers['server'] as string) || null;

      const headerText = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}\r\n` +
        Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
        '\r\n\r\n';
      const headerSize = Buffer.byteLength(headerText);
      const htmlSize = body.length;

      const transport: TransportDiagnostics = {
        tlsVersion,
        cipherSuite,
        alpnProtocol: alpnProtocol || (httpVersion === '2.0' ? 'h2' : 'http/1.1'),
        certificate: certInfo,
        httpVersion,
        compression,
        keepAlive,
        transferEncoding: (response.headers['transfer-encoding'] as string) || null,
        redirectCount,
        redirects,
        serverHeader,
        headers: response.headers
      };

      const performance: PerformanceMetrics = {
        dnsLookupTime: timings.dns,
        tcpConnectTime: timings.tcp,
        tlsHandshakeTime: timings.tls,
        ttfb: timings.ttfb,
        totalTime: timings.total + totalRedirectTime,
        htmlSize,
        headerSize,
        redirectTime: totalRedirectTime
      };

      return { transport, performance, issues };

    } catch (error: any) {
      throw new Error(`Transport analysis failed for ${currentUrl}: ${error.message}`, { cause: error });
    }
  }

  throw new Error(`Too many redirects (limit: ${maxRedirects})`);
}

function executeRequest(urlStr: string, timeout: number): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch (_e) {
      return reject(new Error(`Invalid URL: ${urlStr}`));
    }

    const isHttps = url.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const timings = {
      dns: 0,
      tcp: 0,
      tls: 0,
      ttfb: 0,
      total: 0
    };

    const t0 = performance.now();
    let tDNS = t0;
    let tTCP = t0;
    let tTLS = t0;
    let tReqSent = 0;

    // We use agent: false to force new connection for accurate timing
    const options = {
      method: 'GET',
      timeout,
      rejectUnauthorized: false,
      agent: false,
      headers: {
        'User-Agent': 'Crawlith/Audit',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    };

    const req = requestModule.request(url, options, (res) => {
      // TTFB: Time from request sent to first byte of headers received
      timings.ttfb = performance.now() - (tReqSent || t0);

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        timings.total = performance.now() - t0;
        const body = Buffer.concat(chunks);

        let redirectUrl: string | null = null;
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            redirectUrl = new URL(res.headers.location, urlStr).toString();
          } catch (_e) {
            // Ignore invalid redirect
          }
        }

        resolve({
          url: urlStr,
          response: res,
          body,
          timings,
          socket: res.socket,
          redirectUrl
        });
      });
    });

    req.on('socket', (socket) => {
      socket.on('lookup', () => {
        tDNS = performance.now();
        timings.dns = tDNS - t0;
      });
      socket.on('connect', () => {
        tTCP = performance.now();
        if (timings.dns === 0 && tDNS === t0) {
          // No lookup event
          timings.dns = 0;
          tDNS = t0;
        }
        timings.tcp = tTCP - tDNS;
      });
      socket.on('secureConnect', () => {
        tTLS = performance.now();
        timings.tls = tTLS - tTCP;
      });
    });

    req.on('finish', () => {
      tReqSent = performance.now();
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}
