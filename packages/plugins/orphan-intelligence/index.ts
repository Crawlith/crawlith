import { CrawlPlugin, PluginContext, CLIWriter, ReportWriter, PluginStore } from '@crawlith/core';
import { annotateOrphans, OrphanScoringOptions } from './src/orphanSeverity.js';

export const OrphanIntelligencePlugin: CrawlPlugin = {
  name: 'orphan-intelligence',
  cli: {
    flag: 'orphans',
    description: 'Intelligence engine to detect and score orphaned pages',
    defaultFor: ['crawl']
  },

  storage: {
    perPage: {
      columns: {
        is_orphan: 'INTEGER',
        severity: 'REAL'
      }
    }
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      const flags = ctx.flags || {};
      const options: OrphanScoringOptions = {
        enabled: true,
        severityEnabled: true,
        includeSoftOrphans: !!flags.includeSoftOrphans,
        minInbound: parseInt(flags.minInbound as string ?? '2', 10),
      };

      const nodes = ctx.graph.getNodes();
      const edges = ctx.graph.getEdges();
      const annotatedNodes = annotateOrphans(nodes, edges, options);

      let orphanCount = 0;
      let criticalOrphans = 0;

      for (const annotated of annotatedNodes) {
        ctx.store.upsertPageData(annotated.url, {
          is_orphan: annotated.orphan ? 1 : 0,
          severity: annotated.orphanSeverity || 0
        });

        if (annotated.orphan) {
          orphanCount++;
          if ((annotated.orphanSeverity || 0) > 0.8) criticalOrphans++;
        }
      }

      ctx.store.saveSummary({
        orphanCount,
        criticalOrphans,
        totalEvaluated: nodes.length
      });
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<any>();
      if (!summary) return;

      ctx.report.addSection('Orphan Intelligence', {
        metrics: {
          'Orphan Count': summary.orphanCount,
          'Critical': summary.criticalOrphans
        },
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Orphaned Pages', summary.orphanCount],
          ['High-Severity Orphans', summary.criticalOrphans],
          ['Evaluation Base', summary.totalEvaluated]
        ]
      });
    }
  }
};

export default OrphanIntelligencePlugin;
