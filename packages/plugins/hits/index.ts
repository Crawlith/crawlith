import { computeHITS, type CrawlPlugin, type SiteGraph } from '@crawlith/core';
export const HitsPlugin: CrawlPlugin = {
  name: 'hits',
  cli: {
    flag: 'compute-hits',
    description: 'Compute Hub and Authority scores (HITS)',
    optionalFor: ['crawl']
  },
  async onMetricsPhase(graph: SiteGraph) { computeHITS(graph); }
};
export default HitsPlugin;
