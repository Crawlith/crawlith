import { detectDuplicates, type CrawlPlugin } from '@crawlith/core';
export const DuplicateDetectionPlugin: CrawlPlugin = {
  name: 'duplicate-detection',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph) { detectDuplicates(graph); }
};
export default DuplicateDetectionPlugin;
