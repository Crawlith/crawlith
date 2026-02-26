import * as cheerio from 'cheerio';

/**
 * Extracts all links from an HTML document.
 * Returns absolute URLs.
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  try {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl);
          // Only http(s) links
          if (absoluteUrl.protocol === 'http:' || absoluteUrl.protocol === 'https:') {
            // Remove hash fragments immediately as they are irrelevant for crawling
            absoluteUrl.hash = '';
            links.add(absoluteUrl.toString());
          }
        } catch (_e) {
          // Invalid URL, skip
        }
      }
    });

    return Array.from(links);
  } catch (e) {
    // Silently fail on extraction errors
    return [];
  }
}
