import { detectContentClusters, type CrawlPlugin, type PluginContext, type CLIWriter, type ReportWriter, type PluginStore } from '@crawlith/core';

export const ContentClusteringPlugin: CrawlPlugin = {
  name: 'content-clustering',
  cli: {
    flag: 'clustering',
    description: 'Clusters similar pages to identify potential content cannibalization',
    defaultFor: ['crawl'],
    options: [
      { flags: '--cluster-threshold <number>', description: 'Hamming distance for content clusters', defaultValue: '10' },
      { flags: '--min-cluster-size <number>', description: 'Minimum pages per cluster', defaultValue: '3' },
    ]
  },

  storage: {
    perPage: {
      columns: {
        cluster_id: 'INTEGER'
      }
    }
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      const threshold = Number(ctx.flags?.clusterThreshold ?? 10);
      const minSize = Number(ctx.flags?.minClusterSize ?? 3);

      const clusters = detectContentClusters(ctx.graph, threshold, minSize);

      const nodes = ctx.graph.getNodes();
      let nodesClustered = 0;

      for (const node of nodes) {
        if (node.clusterId) {
          ctx.store.upsertPageData(node.url, {
            cluster_id: node.clusterId
          });
          nodesClustered++;
        }
      }

      ctx.store.saveSummary({
        clusterCount: clusters.length,
        nodesClustered,
        totalNodes: nodes.length,
        clusters: clusters.map(c => ({
          id: c.id,
          count: c.count,
          url: c.primaryUrl,
          risk: c.risk
        }))
      });
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<any>();
      if (!summary) return;

      ctx.report.addSection('Content Cannibalization Clusters', {
        metrics: {
          'Clusters': summary.clusterCount,
          'Clustered Pages': summary.nodesClustered
        },
        headers: ['Cluster ID', 'Primary URL', 'Pages', 'Risk'],
        rows: summary.clusters.map((c: any) => [
          c.id,
          c.url,
          c.count,
          c.risk.toUpperCase()
        ])
      });
    }
  }
};

export default ContentClusteringPlugin;
