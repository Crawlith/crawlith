import { SimHash, type CrawlPlugin, type SiteGraph } from '@crawlith/core';
export const SimhashPlugin: CrawlPlugin = {
  name: 'simhash',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph: SiteGraph) {
    for (const node of graph.getNodes()) {
      const tokens = (((node as any).title ?? node.url) as string).toLowerCase().split(/\W+/).filter(Boolean);
      (node as any).simhash = SimHash.generate(tokens).toString(16);
    }
  }
};
export default SimhashPlugin;
