
import { CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';

/**
 * Crawl Policy Plugin
 * Crawlith plugin for crawl policy
 */
export const CrawlPolicyPlugin: CrawlithPlugin = {
  name: 'crawl-policy',
  register: (cli: Command) => {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
      cli
        .option("--allow <domains>", "comma separated list of domains to allow")
        .option("--deny <domains>", "comma separated list of domains to deny")
        .option("--include-subdomains", "include subdomains in the default scope")
        .option("--ignore-robots", "ignore robots.txt directives")
        .option("--proxy <url>", "proxy URL to use for requests")
        .option("--ua <string>", "user agent string to use")
        .option("--rate <num>", "requests per second limit")
        .option("--max-bytes <num>", "maximum bytes to download per page")
        .option("--max-redirects <num>", "maximum redirects to follow");
    }
  },

  hooks: {
    onInit: async (ctx: PluginContext) => {
      const flags = ctx.flags || {};

      const allowedDomains = flags.allow ? String(flags.allow).split(',').map(d => d.trim()) : [];
      const deniedDomains = flags.deny ? String(flags.deny).split(',').map(d => d.trim()) : [];

      const proxyUrl = flags.proxy ? String(flags.proxy) : undefined;
      if (proxyUrl) {
        try {
          new URL(proxyUrl);
        } catch {
          throw new Error(`Invalid proxy URL: ${proxyUrl}`);
        }
      }

      if (!ctx.metadata) ctx.metadata = {};
      ctx.metadata.crawlPolicy = {
        allowedDomains,
        deniedDomains,
        includeSubdomains: !!flags.includeSubdomains,
        ignoreRobots: !!flags.ignoreRobots,
        proxyUrl,
        userAgent: flags.ua ? String(flags.ua) : undefined,
        rate: flags.rate ? parseFloat(String(flags.rate)) : undefined,
        maxBytes: flags.maxBytes ? parseInt(String(flags.maxBytes), 10) : undefined,
        maxRedirects: flags.maxRedirects ? parseInt(String(flags.maxRedirects), 10) : undefined
      };
    }
  }
};

export default CrawlPolicyPlugin;
