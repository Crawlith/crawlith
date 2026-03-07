import { request, Dispatcher } from 'undici';
import * as net from 'net';
import { IPGuard } from '../core/security/ipGuard.js';
import { RateLimiter } from '../core/network/rateLimiter.js';
import { RetryPolicy } from '../core/network/retryPolicy.js';
import { ResponseLimiter } from '../core/network/responseLimiter.js';
import { RedirectController } from '../core/network/redirectController.js';
import { ProxyAdapter } from '../core/network/proxyAdapter.js';
import { ScopeManager } from '../core/scope/scopeManager.js';
import { DEFAULTS } from '../constants.js';

export interface RedirectStep {
  url: string;
  status: number;
  target: string;
}

export interface FetchResult {
  status: number
  | 'blocked_internal_ip'
  | 'blocked_by_domain_filter'
  | 'blocked_subdomain'
  | 'oversized'
  | 'failed_after_retries'
  | 'network_error'
  | 'redirect_limit_exceeded'
  | 'redirect_loop'
  | 'proxy_connection_failed';
  headers: Record<string, string | string[] | undefined>;
  body: string;
  redirectChain: RedirectStep[];
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
  retries?: number;
  bytesReceived?: number;
}

export interface FetchOptions {
  etag?: string;
  lastModified?: string;
  rate?: number;
  maxBytes?: number;
  crawlDelay?: number;
}

export class Fetcher {
  public userAgent: string = DEFAULTS.USER_AGENT;
  private rateLimiter: RateLimiter;
  private proxyAdapter: ProxyAdapter;
  private secureDispatcher: Dispatcher;
  private scopeManager?: ScopeManager;
  private maxRedirects: number;

  constructor(options: {
    rate?: number;
    proxyUrl?: string;
    scopeManager?: ScopeManager;
    maxRedirects?: number;
    userAgent?: string;
  } = {}) {
    this.rateLimiter = new RateLimiter(options.rate || DEFAULTS.RATE_LIMIT);
    this.proxyAdapter = new ProxyAdapter(options.proxyUrl);

    if (this.proxyAdapter.dispatcher) {
      this.secureDispatcher = this.proxyAdapter.dispatcher;
    } else {
      this.secureDispatcher = IPGuard.getSecureDispatcher();
    }

    this.scopeManager = options.scopeManager;
    this.maxRedirects = Math.min(options.maxRedirects ?? DEFAULTS.MAX_REDIRECTS, DEFAULTS.MAX_REDIRECTS_LIMIT);
    this.userAgent = options.userAgent || DEFAULTS.USER_AGENT;
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const maxBytes = options.maxBytes || DEFAULTS.MAX_BYTES;
    const redirectChain: RedirectStep[] = [];
    const redirectController = new RedirectController(this.maxRedirects, url);

    let currentUrl = url;
    let totalRetries = 0;

    // Use a while(true) and explicit return/continue to handle redirects
    while (true) {
      const urlObj = new URL(currentUrl);

      // 1. SSRF Guard (IP Literals only)
      // We only check explicit IP literals here to fail fast.
      // For domains, we rely on the secureDispatcher (which uses IPGuard.secureLookup)
      // to resolve and validate the IP at connection time, preventing TOCTOU attacks.
      if (net.isIP(urlObj.hostname)) {
        if (IPGuard.isInternal(urlObj.hostname)) {
          return this.errorResult('blocked_internal_ip', currentUrl, redirectChain, totalRetries);
        }
      }

      // 2. Scope Validation (Domain & Subdomain)
      if (this.scopeManager) {
        const eligibility = this.scopeManager.isUrlEligible(currentUrl);
        if (eligibility !== 'allowed') {
          return this.errorResult(eligibility, currentUrl, redirectChain, totalRetries);
        }
      }

      // 3. Rate Limiting
      await this.rateLimiter.waitForToken(urlObj.hostname, options.crawlDelay);

      try {
        // 4. Retry Strategy
        const result = await RetryPolicy.execute(
          async (attempt) => {
            if (attempt > 0) totalRetries++;

            const headers: Record<string, string> = {
              'User-Agent': this.userAgent
            };

            // Conditional GET only for the FIRST request in a chain
            if (redirectChain.length === 0) {
              if (options.etag) headers['If-None-Match'] = options.etag;
              if (options.lastModified) headers['If-Modified-Since'] = options.lastModified;
            }

            const res = await request(currentUrl, {
              method: 'GET',
              headers,
              dispatcher: this.secureDispatcher,
              headersTimeout: 10000,
              bodyTimeout: 10000
            });

            if (RetryPolicy.isRetryableStatus(res.statusCode)) {
              await res.body.dump();
              throw new Error(`Status ${res.statusCode}`);
            }

            return res;
          },
          (error) => RetryPolicy.isNetworkError(error) || error.message.startsWith('Status ')
        );

        const status = result.statusCode;
        const resHeaders = result.headers;

        const getHeader = (name: string): string | null => {
          const val = resHeaders[name.toLowerCase()];
          if (Array.isArray(val)) return val[0];
          return (val as string) || null;
        };

        const etag = getHeader('etag');
        const lastModified = getHeader('last-modified');

        // Handle Redirects
        if (status >= 300 && status < 400 && status !== 304) {
          const location = getHeader('location');
          if (location) {
            let targetUrl: string;
            try {
              targetUrl = new URL(location, currentUrl).toString();
            } catch (_e) {
              // Bad redirect location, treat as final but maybe error?
              const body = await ResponseLimiter.streamToString(result.body, maxBytes);
              return { status, headers: resHeaders, body, redirectChain, etag: null, lastModified: null, finalUrl: currentUrl, retries: totalRetries };
            }

            const redirectError = redirectController.nextHop(targetUrl);
            if (redirectError) {
              await result.body.dump();
              return this.errorResult(redirectError, currentUrl, redirectChain, totalRetries);
            }

            redirectChain.push({ url: currentUrl, status, target: targetUrl });
            await result.body.dump();
            currentUrl = targetUrl;
            continue; // Next iteration for redirect target
          }
        }

        // 5. Max Response Size (Streaming)
        let bytesReceived = 0;
        try {
          const body = status === 304 ? '' : await ResponseLimiter.streamToString(
            result.body,
            maxBytes,
            (bytes) => { bytesReceived = bytes; }
          );

          return {
            status,
            headers: resHeaders,
            body,
            redirectChain,
            etag,
            lastModified,
            finalUrl: currentUrl,
            retries: totalRetries,
            bytesReceived
          };
        } catch (e: any) {
          if (e.message === 'Oversized response') {
            return {
              status: 'oversized',
              headers: resHeaders,
              body: '',
              redirectChain,
              etag: null,
              lastModified: null,
              finalUrl: currentUrl,
              retries: totalRetries,
              bytesReceived
            };
          }
          throw e;
        }

      } catch (error: any) {
        // Map common network errors to specific statuses if needed
        const isProxyError = error.message?.toLowerCase().includes('proxy') || error.code === 'ECONNREFUSED';

        if (error.code === 'EBLOCKED' || error.message?.includes('Blocked internal IP')) {
          return this.errorResult('blocked_internal_ip', currentUrl, redirectChain, totalRetries);
        }

        const finalStatus = isProxyError ? 'proxy_connection_failed' : 'network_error';

        return this.errorResult(
          totalRetries >= RetryPolicy.DEFAULT_CONFIG.maxRetries ? 'failed_after_retries' : finalStatus,
          currentUrl,
          redirectChain,
          totalRetries
        );
      }
    }
  }

  private errorResult(status: any, finalUrl: string, redirectChain: RedirectStep[], retries: number): FetchResult {
    return {
      status,
      headers: {},
      body: '',
      redirectChain,
      etag: null,
      lastModified: null,
      finalUrl,
      retries
    };
  }
}
