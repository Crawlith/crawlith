import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');

import { computeHITS, CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';

/**
 * Hits Plugin
 * Crawlith plugin for hits
 */
export const HitsPlugin: CrawlithPlugin = {
  name: 'hits',
  version: pkg.version,
  description: pkg.description,
  register: (cli: Command) => {
    if (cli.name() === 'crawl') {
      cli.option('--compute-hits', 'Compute Hub and Authority scores (HITS)');
    }
  },
  hooks: {
    onInit: async (_ctx: PluginContext) => {
      // Logic if we want to toggle it based on flag
    },
    onMetrics: async (ctx: PluginContext, graph: any) => {
      if (ctx.flags?.computeHits) {
        computeHITS(graph);
      }
    }
  }
};

export default HitsPlugin;
