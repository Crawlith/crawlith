import { request } from 'undici';
import * as cheerio from 'cheerio';
import { normalizeUrl } from './normalize.js';
import { EngineContext } from '../events.js';

export class Sitemap {
  constructor(private context?: EngineContext) {}

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
      const res = await request(url, {
        maxRedirections: 3,
        headers: { 'User-Agent': 'crawlith/1.0' },
        headersTimeout: 10000,
        bodyTimeout: 10000
      });

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const xml = await res.body.text();
        // Basic validation: must verify it looks like XML
        if (!xml.trim().startsWith('<')) return;

        const $ = cheerio.load(xml, { xmlMode: true });

        // Check if it's a sitemap index
        const sitemaps = $('sitemap > loc');
        if (sitemaps.length > 0) {
          const childSitemaps: string[] = [];
          sitemaps.each((_, el) => {
            const loc = $(el).text().trim();
            if (loc) childSitemaps.push(loc);
          });

          // Process children sequentially to avoid massive concurrency spike
          for (const childUrl of childSitemaps) {
            await this.processSitemap(childUrl, visited, urls);
          }
        } else {
          // It's a URL Set
          $('url > loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc) {
              const normalized = normalizeUrl(loc, '');
              if (normalized) {
                urls.add(normalized);
              }
            }
          });
        }
      } else {
        await res.body.dump();
      }
    } catch (e) {
      this.context?.emit({ type: 'warn', message: `Failed to fetch sitemap ${url}`, context: e });
    }
  }
}
