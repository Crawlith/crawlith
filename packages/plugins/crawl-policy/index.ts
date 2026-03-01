import { CrawlPlugin } from '@crawlith/core';

export const CrawlPolicyPlugin: CrawlPlugin = {
  name: 'CrawlPolicyPlugin',
  cli: {
    defaultFor: ['crawl', 'page'],
    options: [
      { flags: "--allow <domains>", description: "comma separated list of domains to allow" },
      { flags: "--deny <domains>", description: "comma separated list of domains to deny" },
      { flags: "--include-subdomains", description: "include subdomains in the default scope" },
      { flags: "--ignore-robots", description: "ignore robots.txt directives" },
      { flags: "--proxy <url>", description: "proxy URL to use for requests" },
      { flags: "--ua <string>", description: "user agent string to use" },
      { flags: "--rate <num>", description: "requests per second limit" },
      { flags: "--max-bytes <num>", description: "maximum bytes to download per page" },
      { flags: "--max-redirects <num>", description: "maximum redirects to follow" }
    ]
  },
  onInit: async (ctx) => {
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
};
