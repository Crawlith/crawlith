import { computePageRank, type CrawlPlugin } from '@crawlith/core';
export const PageRankPlugin: CrawlPlugin = {
  name: 'pagerank',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph) { computePageRank(graph); }
};
export default PageRankPlugin;
