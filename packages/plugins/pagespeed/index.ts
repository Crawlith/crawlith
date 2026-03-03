import type { CrawlithPlugin } from '@crawlith/core';
import { registerConfigCommand } from './src/cli.js';
import { PageSpeedHooks } from './src/plugin.js';

/**
 * PageSpeed Insights Plugin for Crawlith.
 *
 * Provides automated performance auditing for scanned URLs using the Google PageSpeed Insights API.
 * Features:
 * - 24h Global Persistent Caching (via ctx.db)
 * - Secure Config (via ctx.config)
 */
export const PageSpeedPlugin: CrawlithPlugin = {
  name: 'pagespeed',

  cli: {
    flag: '--pagespeed',
    description: 'Attach Google PageSpeed Insights report (mobile strategy)',
    for: ['page'],
    options: [
      { flag: '--force', description: 'Force a fresh PageSpeed API request and bypass 24h cache' }
    ]
  },

  scoreProvider: true,

  storage: {
    perPage: {
      columns: {
        strategy: 'TEXT',
        performance_score: 'INTEGER',
        lcp: 'REAL',
        cls: 'REAL',
        tbt: 'REAL',
        raw_json: 'TEXT'
      }
    }
  },

  /**
   * Keeps the `pagespeed config` subcommand — not replaceable by declarative cli.
   */
  register: (cli) => {
    registerConfigCommand(cli);
  },

  hooks: PageSpeedHooks
};

export default PageSpeedPlugin;