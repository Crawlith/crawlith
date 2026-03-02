
import { CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command } from '@crawlith/core';
import { annotateOrphans, OrphanScoringOptions } from './src/orphanSeverity.js';

export * from './src/orphanSeverity.js';

/**
 * Orphan Intelligence Plugin
 * Crawlith plugin for orphan intelligence
 */
export const OrphanIntelligencePlugin: CrawlithPlugin = {
  name: 'orphan-intelligence',
  register: (cli: Command) => {
    if (cli.name() === 'crawl') {
      cli
        .option("--orphans", "Detect orphaned pages")
        .option("--orphan-severity", "Severity for orphans (low/medium/high)")
        .option("--include-soft-orphans", "Include soft orphans")
        .option("--min-inbound <value>", "Minimum inbound links to not be an orphan", "2");
    }
  },

  hooks: {
    onMetrics: async (ctx: PluginContext, graph: any) => {
      const flags = ctx.flags || {};

      if (!flags.orphans) {
        return;
      }

      ctx.logger?.info('🔍 Detecting orphaned pages...');

      const options: OrphanScoringOptions = {
        enabled: true,
        severityEnabled: !!flags.orphanSeverity,
        includeSoftOrphans: !!flags.includeSoftOrphans,
        minInbound: parseInt(flags.minInbound as string ?? '2', 10),
        rootUrl: undefined
      };

      const nodes = graph.getNodes();
      const edges = graph.getEdges();

      const annotatedNodes = annotateOrphans(nodes, edges, options);

      // Mutate the graph nodes in place
      for (const annotated of annotatedNodes) {
        if (annotated.orphan) {
          const graphNode = graph.getNode(annotated.url);
          if (graphNode) {
            graphNode.orphanScore = annotated.orphanSeverity;
            graphNode.orphanType = annotated.orphanType;
          }
        }
      }

      ctx.logger?.info(`🔍 Orphan detection complete.`);
    },
    onReport: async (ctx: PluginContext, result: any) => {
      const isCrawl = !!result.snapshotId && !!result.graph;
      if (isCrawl && result.graph) {
        const nodes = result.graph.getNodes();
        const orphans = nodes.filter((n: any) => n.orphanScore && n.orphanScore !== 'low');
        if (orphans.length > 0) {
          if (!result.plugins) result.plugins = {};
          result.plugins.orphanIntelligence = {
            criticalOrphans: orphans.length,
            sampleOrphans: orphans.slice(0, 10).map((n: any) => ({ url: n.url, severity: n.orphanScore }))
          };
        }
      }
    }
  }
};

export default OrphanIntelligencePlugin;
