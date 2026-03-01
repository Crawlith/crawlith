import { computeHITS, type CrawlPlugin, type SiteGraph } from '@crawlith/core';
export const HitsPlugin: CrawlPlugin = {
  name: 'hits',
  cli: { flag: 'compute-hits', optionalFor: ['crawl'] },
  async onMetricsPhase(graph: SiteGraph) { computeHITS(graph); }
};
export default HitsPlugin;
