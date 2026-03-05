import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { normalizeUrl } from './normalize.js';
import { EngineContext } from '../events.js';
import { Fetcher } from './fetcher.js';
import { DEFAULTS } from '../constants.js';

export class Sitemap {
  private userAgent: string = DEFAULTS.USER_AGENT;
  constructor(private context?: EngineContext, private fetcher?: Fetcher, userAgent?: string) {
    if (userAgent) this.userAgent = userAgent;
    else if (fetcher) this.userAgent = fetcher.userAgent;
  }

  /**
   * Fetches and parses a sitemap (or sitemap index) to extract URLs.
   * Recursively handles sitemap indexes with loop detection and depth limits.
   */
  async fetch(url: string): Promise<string[]> {
    const visited = new Set<string>();
    const urls = new Set<string>();

    await this.processSitemap(url, visited, urls);

    return Array.from(urls);
  }

  private async processSitemap(url: string, visited: Set<string>, urls: Set<string>) {
    if (visited.has(url)) return;
    visited.add(url);

    // Hard limit on number of sitemaps to fetch to prevent abuse
    if (visited.size > 50) return;

    try {
      const res = this.fetcher
        ? await this.fetcher.fetch(url, { maxBytes: 5000000 })
        : await (async () => {
          const { request } = await import('undici');
          const r = await request(url, { headers: { 'User-Agent': this.userAgent } });
          const b = await r.body.text();
          return { status: r.statusCode, body: b };
        })();

      if (typeof res.status === 'number' && res.status >= 200 && res.status < 300) {
        const xml = res.body;
        // Basic validation: must verify it looks like XML
        if (!xml.trim().startsWith('<')) return;

        const $ = cheerio.load(xml, { xmlMode: true });

        // Check if it's a sitemap index
        const sitemaps = $('sitemap > loc');
        if (sitemaps.length > 0) {
          const childSitemaps: string[] = [];
          sitemaps.each((_: number, el: any) => {
            const loc = $(el).text().trim();
            if (loc) childSitemaps.push(loc);
          });

          // Process children concurrently but with a limit to avoid massive concurrency spike
          const limit = pLimit(10);
          await Promise.all(
            childSitemaps.map(childUrl => limit(() => this.processSitemap(childUrl, visited, urls)))
          );
        } else {
          // It's a URL Set
          $('url > loc').each((_: number, el: any) => {
            const loc = $(el).text().trim();
            if (loc) {
              const normalized = normalizeUrl(loc, '');
              if (normalized) {
                urls.add(normalized);
              }
            }
          });
        }
      }
    } catch (e) {
      this.context?.emit({ type: 'warn', message: `Failed to fetch sitemap ${url} (${String(e)})`, context: e });
    }
  }
}
