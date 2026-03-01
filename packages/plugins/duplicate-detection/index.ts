import { detectDuplicates, type CrawlPlugin, type SiteGraph } from '@crawlith/core';
export const DuplicateDetectionPlugin: CrawlPlugin = {
  name: 'duplicate-detection',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph: SiteGraph) { detectDuplicates(graph); }
};
export default DuplicateDetectionPlugin;
