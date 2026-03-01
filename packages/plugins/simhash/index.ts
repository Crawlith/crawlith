import { SimHash, type CrawlPlugin } from '@crawlith/core';
export const SimhashPlugin: CrawlPlugin = {
  name: 'simhash',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph) {
    for (const node of graph.getNodes()) {
      const tokens = (node.title ?? node.url).toLowerCase().split(/\W+/).filter(Boolean);
      node.simhash = SimHash.generate(tokens).toString(16);
    }
  }
};
export default SimhashPlugin;
