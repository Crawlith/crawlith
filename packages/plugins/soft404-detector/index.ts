import { CrawlithPlugin, PluginContext } from '@crawlith/core';
import * as cheerio from 'cheerio';
import { Command } from 'commander';

export const Soft404DetectorPlugin: CrawlithPlugin = {
  name: 'soft404-detector',
  version: '1.0.0',

  register: (cli: Command) => {
    if (cli.name() === 'crawl') {
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
          let soft404Score = 0;
          const soft404Signals: string[] = [];

          const $ = cheerio.load(node.html);
          $('script, style, noscript, iframe').remove();

          const cleanText = $('body').text().replace(/\s+/g, ' ').trim();
          const title = $('title').text().toLowerCase();
          const h1Text = $('h1').first().text().toLowerCase();
          const bodyText = cleanText.toLowerCase();

          const errorPatterns = ['404', 'not found', 'error', "doesn't exist", 'unavailable', 'invalid'];

          for (const pattern of errorPatterns) {
            if (title.includes(pattern)) {
              soft404Score += 0.4;
              soft404Signals.push(`title_pattern_${pattern.replace(/\s+/g, '_')}`);
              break;
            }
          }

          for (const pattern of errorPatterns) {
            if (h1Text.includes(pattern)) {
              soft404Score += 0.3;
              soft404Signals.push(`h1_pattern_${pattern.replace(/\s+/g, '_')}`);
              break;
            }
          }

          if (bodyText.includes('page not found') || bodyText.includes('404 error')) {
            soft404Score += 0.2;
            soft404Signals.push('body_error_phrase');
          }

          const words = cleanText.split(/\s+/).filter(w => w.length > 0);
          if (words.length < 50) {
            soft404Score += 0.3;
            soft404Signals.push('very_low_word_count');
          } else if (words.length < 150) {
            soft404Score += 0.1;
            soft404Signals.push('low_word_count');
          }

          if (node.outLinks === 0) {
            soft404Score += 0.2;
            soft404Signals.push('no_outbound_links');
          }

          soft404Score = Math.min(1.0, soft404Score);

          node.soft404Score = soft404Score;
          node.soft404Signals = soft404Signals;
        }
      }

      ctx.logger?.info?.(`🕵️ Soft 404 detection complete.`);
    }
  }
};

export default Soft404DetectorPlugin;
