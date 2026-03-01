import { detectContentClusters, type CrawlPlugin, type SiteGraph, type MetricsContext } from '@crawlith/core';
export const ContentClusteringPlugin: CrawlPlugin = {
  name: 'content-clustering',
  cli: {
    defaultFor: ['crawl'],
    options: [
      { flags: '--cluster-threshold <number>', description: 'Hamming distance for content clusters', defaultValue: '10' },
      { flags: '--min-cluster-size <number>', description: 'Minimum pages per cluster', defaultValue: '3' },
    ]
  },
  async onMetricsPhase(graph: SiteGraph, ctx: MetricsContext) {
    const threshold = Number((ctx.metadata?.clusterThreshold as number) ?? 10);
    const minSize = Number((ctx.metadata?.minClusterSize as number) ?? 3);
    detectContentClusters(graph, threshold, minSize);
  }
};
export default ContentClusteringPlugin;
