import type { CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';

function headingHealth(html?: string): number {
  if (!html) return 0;
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;
  if (h1Count !== 1) return Math.max(0, 60 - Math.abs(h1Count - 1) * 20);
  return Math.min(100, 70 + Math.min(h2Count, 3) * 10);
}

export const HeadingHealthPlugin: CrawlithPlugin = {
  name: 'heading-health',
  version: '1.0.0',

  register: (cli: Command) => {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
      cli.option('--heading', 'Analyze heading structure');
    }
  },

  hooks: {
    onPageParsed: async (ctx: PluginContext, page: any) => {
      ctx.metadata = ctx.metadata ?? {};
      const map = (ctx.metadata.headingHealth as Record<string, number> | undefined) ?? {};
      map[page.url] = headingHealth(page.html);
      ctx.metadata.headingHealth = map;
    },
    onReport: async (ctx: PluginContext, result: any) => {
      if (ctx.metadata?.headingHealth) {
        // Add to site summary or individual pages
        if (!result.plugins) result.plugins = {};
        result.plugins.headingHealth = ctx.metadata.headingHealth;

        // Also attach to individual pages if they exist in the report
        if (result.pages) {
          for (const page of result.pages) {
            if (ctx.metadata.headingHealth[page.url] !== undefined) {
              if (!page.plugins) page.plugins = {};
              page.plugins.headingHealth = ctx.metadata.headingHealth[page.url];
            }
          }
        }
      }
    }
  }
};

export default HeadingHealthPlugin;

