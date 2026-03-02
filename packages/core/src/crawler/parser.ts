import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import { normalizeUrl } from './normalize.js';
import { SimHash } from '../graph/simhash.js';

export interface ParseLink {
  url: string;
  weight: number;
}

export interface ParseResult {
  links: ParseLink[];
  html: string;
  canonical: string | null;
  noindex: boolean;
  nofollow: boolean;
  contentHash: string;
  simhash?: string;
  uniqueTokenRatio?: number;
  soft404Score: number;
  soft404Signals: string[];
}

export class Parser {
  /**
   * Parses HTML content to extract metadata and links.
   */
  parse(html: string, baseUrl: string, _status: number): ParseResult {
    const $ = cheerio.load(html);

    // 1. Robots Meta
    let noindex = false;
    let nofollow = false;
    const robotsMeta = $('meta[name="robots"]').attr('content');
    if (robotsMeta) {
      const directives = robotsMeta.toLowerCase().split(',').map(s => s.trim());
      if (directives.includes('noindex') || directives.includes('none')) noindex = true;
      if (directives.includes('nofollow') || directives.includes('none')) nofollow = true;
    }

    // 2. Canonical
    let canonical: string | null = null;
    const canonicalLink = $('link[rel="canonical"]').attr('href');
    if (canonicalLink) {
      try {
        // Resolve relative canonicals
        const u = new URL(canonicalLink, baseUrl);
        // Normalize minimally (remove default ports, lowercase host, etc)
        // We don't strip query by default for canonical as it might be relevant
        canonical = normalizeUrl(u.toString(), '', { stripQuery: false });
      } catch (_e) {
        // Invalid canonical URL, ignore
      }
    }

    // 3. Links
    const links = new Map<string, number>();
    if (!nofollow) { // Don't extract links if nofollow is set
      $('a').each((_: number, element: any) => {
        const href = $(element).attr('href');
        const rel = $(element).attr('rel');
        const isNofollow = rel && rel.toLowerCase().includes('nofollow');

        if (href && !isNofollow) {
          try {
            const absoluteUrl = new URL(href, baseUrl);
            if (absoluteUrl.protocol === 'http:' || absoluteUrl.protocol === 'https:') {
              absoluteUrl.hash = '';
              const urlStr = absoluteUrl.toString();

              // Calculate Weight
              let weight = 1.0; // Default: Body

              // Semantic Check
              const $el = $(element);
              if ($el.closest('nav').length > 0 || $el.closest('header').length > 0) {
                weight = 0.7;
              } else if ($el.closest('footer').length > 0) {
                weight = 0.4;
              } else {
                // Secondary check: Common attributes
                const parentText = ($el.parent().attr('class') || '') + ($el.parent().attr('id') || '');
                const grandParentText = ($el.parent().parent().attr('class') || '') + ($el.parent().parent().attr('id') || '');
                const combinedContext = (parentText + grandParentText).toLowerCase();

                if (combinedContext.includes('nav') || combinedContext.includes('menu')) {
                  weight = 0.7;
                } else if (combinedContext.includes('footer')) {
                  weight = 0.4;
                }
              }

              // Store highest weight if multiple links to same URL
              const currentMax = links.get(urlStr) || 0;
              if (weight > currentMax) {
                links.set(urlStr, weight);
              }
            }
          } catch (_e) {
            // Invalid URL
          }
        }
      });
    }

    // 4. Content Hash (ignoring script/style/comments)
    // Clone body to avoid modifying the loaded doc (though we don't reuse it)
    // Actually cheerio load gives us a fresh instance.
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove();

    const cleanText = $('body').text().replace(/\s+/g, ' ').trim();
    const contentHash = crypto.createHash('sha256').update(cleanText).digest('hex');

    // 4b. Simhash & Token calculation (limit to 50k chars for performance)
    const limitedText = cleanText.substring(0, 50000).toLowerCase();
    const tokens = limitedText.split(/\W+/).filter(t => t.length > 0);
    const uniqueTokens = new Set(tokens);
    const uniqueTokenRatio = tokens.length > 0 ? (uniqueTokens.size / tokens.length) : 0;
    const simhash = SimHash.generate(tokens).toString();

    // 5. Soft 404 Detection (Migrated to Soft404DetectorPlugin)
    const soft404Score = 0;
    const soft404Signals: string[] = [];

    return {
      links: Array.from(links.entries()).map(([url, weight]) => ({ url, weight })),
      html: html, // pass raw HTML for analysis
      canonical,
      noindex,
      nofollow,
      contentHash,
      simhash,
      uniqueTokenRatio,
      soft404Score,
      soft404Signals
    }
  }
}
