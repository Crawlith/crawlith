import { computeHITS, type CrawlPlugin, type PluginContext, type CLIWriter, type ReportWriter, type PluginStore } from '@crawlith/core';

export const HitsPlugin: CrawlPlugin = {
  name: 'hits',
  cli: {
    flag: 'hits',
    description: 'Compute Hub and Authority scores (HITS)',
    optionalFor: ['crawl']
  },

  storage: {
    perPage: {
      columns: {
        hub_score: 'REAL',
        authority_score: 'REAL'
      }
    }
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      computeHITS(ctx.graph);

      const nodes = ctx.graph.getNodes();
      let hubCount = 0;
      let authCount = 0;

      for (const node of nodes) {
        if (node.hubScore !== undefined || node.authorityScore !== undefined) {
          ctx.store.upsertPageData(node.url, {
            hub_score: node.hubScore || 0,
            authority_score: node.authorityScore || 0
          });
          if ((node.hubScore || 0) > 0.5) hubCount++;
          if ((node.authorityScore || 0) > 0.5) authCount++;
        }
      }

      ctx.store.saveSummary({
        hubCount,
        authCount,
        totalNodes: nodes.length
      });
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<any>();
      if (!summary) return;

      ctx.report.addSection('HITS (Hubs & Authorities)', {
        metrics: {
          'Strong Hubs': summary.hubCount,
          'Strong Authorities': summary.authCount
        },
        headers: ['Metric', 'Count'],
        rows: [
          ['Significant Hubs', summary.hubCount],
          ['Significant Authorities', summary.authCount],
          ['Total Pages Analyzed', summary.totalNodes]
        ]
      });
    }
  }
};

export default HitsPlugin;
