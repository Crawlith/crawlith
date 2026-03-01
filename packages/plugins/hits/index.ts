import { computeHITS, type CrawlPlugin } from '@crawlith/core';
export const HitsPlugin: CrawlPlugin = {
  name: 'hits',
  cli: { flag: 'compute-hits', optionalFor: ['crawl'] },
  async onMetricsPhase(graph) { computeHITS(graph); }
};
export default HitsPlugin;
