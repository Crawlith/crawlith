import { detectDuplicates, type CrawlPlugin, type PluginContext, type CLIWriter, type ReportWriter, type PluginStore } from '@crawlith/core';

export const DuplicateDetectionPlugin: CrawlPlugin = {
  name: 'duplicate-detection',
  cli: {
    flag: 'duplicates',
    description: 'Detects exact and near-duplicate pages and clusters them',
    defaultFor: ['crawl', 'page'],
    options: [
      { flags: '--no-collapse', description: 'Do not collapse duplicate clusters before PageRank' },
    ]
  },

  storage: {
    perPage: {
      columns: {
        cluster_id: 'TEXT',
        type: 'TEXT',
        is_primary: 'INTEGER',
        is_collapsed: 'INTEGER'
      }
    }
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      const collapse = ctx.flags?.['no-collapse'] === undefined;
      detectDuplicates(ctx.graph, { collapse });

      const nodes = ctx.graph.getNodes();
      let duplicateCount = 0;
      let primaryCount = 0;
      let exactCount = 0;
      let nearCount = 0;

      for (const node of nodes) {
        if (node.duplicateClusterId) {
          ctx.store.upsertPageData(node.url, {
            cluster_id: node.duplicateClusterId,
            type: node.duplicateType,
            is_primary: node.isClusterPrimary ? 1 : 0,
            is_collapsed: node.isCollapsed ? 1 : 0
          });

          duplicateCount++;
          if (node.isClusterPrimary) primaryCount++;
          if (node.duplicateType === 'exact') exactCount++;
          if (node.duplicateType === 'near') nearCount++;
        }
      }

      ctx.store.saveSummary({
        duplicateCount,
        clusterCount: primaryCount,
        exactCount,
        nearCount,
        totalNodes: nodes.length
      });
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<any>();
      if (!summary) return;

      ctx.report.addSection('Duplicate Content Clusters', {
        metrics: {
          'Duplicates': summary.duplicateCount,
          'Clusters': summary.clusterCount
        },
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Duplicates Found', summary.duplicateCount],
          ['Unique Content Clusters', summary.clusterCount],
          ['Exact Duplicates', summary.exactCount],
          ['Near Duplicates', summary.nearCount],
          ['Duplicate Ratio', `${((summary.duplicateCount / (summary.totalNodes || 1)) * 100).toFixed(1)}%`]
        ]
      });
    }
  }
};

export default DuplicateDetectionPlugin;
