import { detectContentClusters, type CrawlPlugin } from '@crawlith/core';
export const ContentClusteringPlugin: CrawlPlugin = {
  name: 'content-clustering',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph, ctx) {
    const threshold = Number((ctx.metadata?.clusterThreshold as number) ?? 10);
    const minSize = Number((ctx.metadata?.minClusterSize as number) ?? 3);
    detectContentClusters(graph, threshold, minSize);
  }
};
export default ContentClusteringPlugin;
