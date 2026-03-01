import { CrawlPlugin } from '@crawlith/core';
import * as cheerio from 'cheerio';

export const Soft404DetectorPlugin: CrawlPlugin = {
  name: 'Soft404DetectorPlugin',
  cli: {
    defaultFor: ['crawl'],
    options: [
      { flags: "--detect-soft404", description: "Detect soft 404 pages" }
    ]
  },
  onMetricsPhase: async (graph: any, context: any) => {
    const flags = context.flags || {};

    if (!flags.detectSoft404) {
      return;
    }

    context.logger?.info?.('🕵️ Detecting soft 404 pages...');

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
        // Even though GraphNode doesn't explicitly guarantee signals, plugins can attach any property dynamically for serializers
        node.soft404Signals = soft404Signals;
      }
    }

    context.logger?.info?.(`🕵️ Soft 404 detection complete.`);
  }
};
