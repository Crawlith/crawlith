
import { SimHash, CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';

/**
 * Simhash Plugin
 * Crawlith plugin for simhash
 */
export const SimhashPlugin: CrawlithPlugin = {
  name: 'simhash',  register: (_cli: Command) => {
    // Default for crawl in original, no new flags added.
  },
  hooks: {
    onMetrics: async (ctx: PluginContext, graph: any) => {
      for (const node of graph.getNodes()) {
        const title = (node as any).title || '';
        const tokens = (title || node.url).toLowerCase().split(/\W+/).filter(Boolean);
        node.simhash = SimHash.generate(tokens).toString(16);
      }
    }
  }
};

export default SimhashPlugin;
