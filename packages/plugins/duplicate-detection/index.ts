import { detectDuplicates, CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from 'commander';

export const DuplicateDetectionPlugin: CrawlithPlugin = {
  name: 'duplicate-detection',
  version: '1.0.0',
  register: (cli: Command) => {
    if (cli.name() === 'crawl') {
      cli.option('--no-collapse', 'Do not collapse duplicate clusters before PageRank');
    }
  },
  hooks: {
    onMetrics: async (ctx: PluginContext, graph: any) => {
      const collapse = ctx.flags?.collapse !== false;
      detectDuplicates(graph, { collapse });
    }
  }
};

export default DuplicateDetectionPlugin;
