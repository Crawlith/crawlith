import type { CrawlPlugin } from '@crawlith/core';

function headingHealth(html?: string): number {
  if (!html) return 0;
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;
  if (h1Count !== 1) return Math.max(0, 60 - Math.abs(h1Count - 1) * 20);
  return Math.min(100, 70 + Math.min(h2Count, 3) * 10);
}

export const HeadingHealthPlugin: CrawlPlugin = {
  name: 'heading-health',
  cli: {
    flag: 'heading',
    description: 'Analyze heading structure',
    defaultFor: ['crawl'],
    optionalFor: ['page']
  },
  async onPageParsed(page, ctx) {
    ctx.metadata = ctx.metadata ?? {};
    const map = (ctx.metadata.headingHealth as Record<string, number> | undefined) ?? {};
    map[page.url] = headingHealth(page.html);
    ctx.metadata.headingHealth = map;
  }
};

export default HeadingHealthPlugin;
