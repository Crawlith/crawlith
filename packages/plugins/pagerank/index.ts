import { computePageRank, type CrawlPlugin, type SiteGraph } from '@crawlith/core';
export const PageRankPlugin: CrawlPlugin = {
  name: 'pagerank',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph: SiteGraph) { computePageRank(graph); }
};
export default PageRankPlugin;
