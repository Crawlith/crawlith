import { detectContentClusters, CrawlithPlugin, PluginContext, Command, Graph } from '@crawlith/core';

export const ContentClusteringPlugin: CrawlithPlugin = {
  name: 'content-clustering',
  version: '1.0.0',
  register: (cli: Command) => {
    if (cli.name() === 'crawl') {
      cli.option('--cluster-threshold <number>', 'Hamming distance for content clusters', '10');
      cli.option('--min-cluster-size <number>', 'Minimum pages per cluster', '3');
    }
  },
  hooks: {
    onMetrics: async (ctx: PluginContext, graph: Graph) => {
      const threshold = Number(ctx.flags?.clusterThreshold ?? 10);
      const minSize = Number(ctx.flags?.minClusterSize ?? 3);
      detectContentClusters(graph as any, threshold, minSize);
    }
  }
};

export default ContentClusteringPlugin;
