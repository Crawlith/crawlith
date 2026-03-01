import { SimHash, type CrawlPlugin, type SiteGraph, type GraphNode } from '@crawlith/core';
export const SimhashPlugin: CrawlPlugin = {
  name: 'simhash',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph: SiteGraph) {
    for (const node of graph.getNodes()) {
      const tokens = ((node as GraphNode & { title?: string }).title ?? node.url).toLowerCase().split(/\W+/).filter(Boolean);
      node.simhash = SimHash.generate(tokens).toString(16);
    }
  }
};
export default SimhashPlugin;
