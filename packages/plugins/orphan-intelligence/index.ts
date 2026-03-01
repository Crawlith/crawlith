import { CrawlPlugin } from '@crawlith/core';
import { annotateOrphans, OrphanScoringOptions } from './src/orphanSeverity.js';

export * from './src/orphanSeverity.js';

export const OrphanIntelligencePlugin: CrawlPlugin = {
  name: 'OrphanIntelligencePlugin',
  cli: {
    defaultFor: ['crawl'],
    options: [
      { flags: "--orphans", description: "Detect orphaned pages" },
      { flags: "--orphan-severity", description: "Severity for orphans (low/medium/high)" },
      { flags: "--include-soft-orphans", description: "Include soft orphans" },
      { flags: "--min-inbound <value>", description: "Minimum inbound links to not be an orphan", defaultValue: "2" }
    ]
  },
  onMetricsPhase: async (graph: any, context: any) => {
    const flags = context.flags || {};

    if (!flags.orphans) {
      return;
    }

    context.logger?.info?.('🔍 Detecting orphaned pages...');

    const options: OrphanScoringOptions = {
      enabled: true,
      severityEnabled: !!flags.orphanSeverity,
      includeSoftOrphans: !!flags.includeSoftOrphans,
      minInbound: parseInt(flags.minInbound as string ?? '2', 10),
      rootUrl: undefined // can't reliably get rootUrl from graph without a startUrl property, but depth 0 does exactly the same check normally.
    };

    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    const annotatedNodes = annotateOrphans(nodes, edges, options);

    // Mutate the graph nodes in place as expected by @crawlith/core graph plugin pattern
    for (const annotated of annotatedNodes) {
      if (annotated.orphan) {
        const graphNode = graph.getNode(annotated.url);
        if (graphNode) {
          graphNode.orphanScore = annotated.orphanSeverity;
        }
      }
    }

    context.logger?.info?.(`🔍 Orphan detection complete.`);
  }
};
