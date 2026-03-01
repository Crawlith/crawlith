import { detectDuplicates, type CrawlPlugin, type SiteGraph } from '@crawlith/core';
export const DuplicateDetectionPlugin: CrawlPlugin = {
  name: 'duplicate-detection',
  cli: {
    defaultFor: ['crawl'],
    options: [
      { flags: '--no-collapse', description: 'Do not collapse duplicate clusters before PageRank' },
    ]
  },
  async onMetricsPhase(graph: SiteGraph) { detectDuplicates(graph, { collapse: true }); }
};
export default DuplicateDetectionPlugin;
