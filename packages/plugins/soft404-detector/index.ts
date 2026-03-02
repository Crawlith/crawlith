import { CrawlithPlugin, PluginContext } from '@crawlith/core';
import * as cheerio from 'cheerio';
import { Command } from '@crawlith/core';

export const Soft404DetectorPlugin: CrawlithPlugin = {
  name: 'soft404-detector',
  version: '1.0.0',

  register: (cli: Command) => {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
      cli.option('--detect-soft404', 'Detect soft 404 pages');
    }
  },

  hooks: {
    onMetrics: async (ctx: PluginContext, graph: any) => {
      const flags = ctx.flags || {};

      if (!flags.detectSoft404) {
        return;
      }

      ctx.logger?.info?.('🕵️ Detecting soft 404 pages...');

      const nodes = graph.getNodes();

      for (const node of nodes) {
        if (node.status === 200 && node.html) {
          let score = 0;
          const signals: string[] = [];

          const $ = cheerio.load(node.html);
          $('script, style, noscript, iframe').remove();

          const cleanText = $('body').text().replace(/\s+/g, ' ').trim();
          const title = $('title').text().toLowerCase();
          const h1Text = $('h1').first().text().toLowerCase();
          const bodyText = cleanText.toLowerCase();

          const errorPatterns = ['404', 'not found', 'error', "doesn't exist", 'unavailable', 'invalid'];

          for (const pattern of errorPatterns) {
            if (title.includes(pattern)) {
              score += 0.4;
              signals.push(`title_contains_${pattern}`);
              break;
            }
          }

          for (const pattern of errorPatterns) {
            if (h1Text.includes(pattern)) {
              score += 0.3;
              signals.push(`h1_contains_${pattern}`);
              break;
            }
          }

          if (bodyText.includes('page not found') || bodyText.includes('404 error')) {
            score += 0.2;
            signals.push('body_error_phrase');
          }

          const words = cleanText.split(/\s+/).filter(w => w.length > 0);
          if (words.length < 50) {
            score += 0.3;
            signals.push('very_low_word_count');
          } else if (words.length < 150) {
            score += 0.1;
            signals.push('low_word_count');
          }

          if (node.outLinks === 0) {
            score += 0.2;
            signals.push('no_outbound_links');
          }

          score = Math.min(1.0, score);

          if (score > 0) {
            (node as any).soft404 = {
              score: Number(score.toFixed(2)),
              reason: signals.join(', ')
            };
          }
        }
      }

      ctx.logger?.info?.(`🕵️ Soft 404 detection complete.`);
    },
    onReport: async (ctx: PluginContext, result: any) => {
      const flags = ctx.flags || {};
      if (!flags.detectSoft404) return;

      const soft404Pages = result.pages.filter((p: any) => p.plugins?.soft404?.score > 0.5);
      if (soft404Pages.length > 0) {
        if (!result.plugins) result.plugins = {};
        result.plugins.soft404 = {
          totalDetected: soft404Pages.length,
          topSample: soft404Pages.slice(0, 5).map((p: any) => ({ url: p.url, score: p.plugins.soft404.score }))
        };
      }
    }
  }
};

export default Soft404DetectorPlugin;
