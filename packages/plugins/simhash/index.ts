import { SimHash, type CrawlPlugin, type PluginContext, type CLIWriter, type ReportWriter, type PluginStore } from '@crawlith/core';

export const SimhashPlugin: CrawlPlugin = {
  name: 'simhash',
  cli: {
    flag: 'simhash',
    description: 'Generates similarity hashes for pages based on their content',
    defaultFor: ['crawl']
  },

  storage: {
    perPage: {
      columns: {
        hash: 'TEXT'
      }
    }
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      const nodes = ctx.graph.getNodes();
      let generatedCount = 0;

      for (const node of nodes) {
        if (!node.simhash) {
          // Fallback to title/url if content hash is missing or for initial calculation
          const tokens = (node.title ?? node.url).toLowerCase().split(/\W+/).filter(Boolean);
          node.simhash = SimHash.generate(tokens).toString(16);
        }

        ctx.store.upsertPageData(node.url, {
          hash: node.simhash
        });
        generatedCount++;
      }

      ctx.store.saveSummary({
        generatedCount,
        totalNodes: nodes.length
      });
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<any>();
      if (!summary) return;

      ctx.report.addSection('Similarity Hashes', {
        metrics: {
          'Generated': summary.generatedCount
        },
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Hashes Generated', summary.generatedCount],
          ['Generation Rate', `${((summary.generatedCount / (summary.totalNodes || 1)) * 100).toFixed(1)}%`]
        ]
      });
    }
  }
};

export default SimhashPlugin;
