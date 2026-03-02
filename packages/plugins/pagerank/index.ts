
import { computePageRank, CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';

/**
 * Pagerank Plugin
 * Crawlith plugin for pagerank
 */
export const PageRankPlugin: CrawlithPlugin = {
  name: 'pagerank',  register: (_cli: Command) => {
    // Enabled by default for crawl command in previous version's defaultFor
    // If it doesn't need flags, we don't necessarily need to add any, 
    // but the system will load it based on discovery.
  },
  hooks: {
    onMetrics: async (ctx: PluginContext, graph: any) => {
      computePageRank(graph);
    }
  }
};

export default PageRankPlugin;
