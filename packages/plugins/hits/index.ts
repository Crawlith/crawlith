
import { computeHITS, CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';

/**
 * Hits Plugin
 * Crawlith plugin for hits
 */
export const HitsPlugin: CrawlithPlugin = {
  name: 'hits',  register: (cli: Command) => {
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
