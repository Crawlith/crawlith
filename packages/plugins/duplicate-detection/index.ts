import { CrawlithPlugin, PluginContext, Graph } from '@crawlith/core';
import { Command } from '@crawlith/core';
import { DuplicateService } from './src/Service.js';

/**
 * Duplicate Detection Plugin
 * Crawlith plugin for duplicate detection
 */
export const DuplicateDetectionPlugin: CrawlithPlugin = {
  name: 'duplicate-detection',

  cli: {
    flag: '--duplicate-detection',
    description: 'Detect exact and near duplicates'
  },

  register: (cli: Command) => {
    if (cli.name() === 'crawl') {
      cli.option('--no-collapse', 'Do not collapse duplicate clusters before PageRank');
    }
  },

  hooks: {
    onMetrics: async (ctx: PluginContext, graph: Graph) => {
      const flags = ctx.flags || {};
      const collapse = flags.collapse !== false;

      const service = new DuplicateService();
      service.detectDuplicates(graph, { collapse });
    }
  }
};

export default DuplicateDetectionPlugin;
