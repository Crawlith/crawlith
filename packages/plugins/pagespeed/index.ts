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

  /**
   * Registers CLI commands and options for the PageSpeed plugin.
   * This acts as the visual manifest of what the plugin adds to the CLI.
   */
  register: (cli) => {
    registerConfigCommand(cli);

    if (cli.name() === 'page') {
      cli.option('--pagespeed', 'Attach Google PageSpeed Insights report (mobile strategy)');
      cli.option('--force', 'Force a fresh PageSpeed API request and bypass 24h cache');
    }
  },

  /**
   * Internal logic implementation is delegated to src/plugin.js
   */
  hooks: PageSpeedHooks
};

export default PageSpeedPlugin;