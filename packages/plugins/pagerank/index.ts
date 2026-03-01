import { computePageRank, type CrawlPlugin, type PluginContext, type CLIWriter, type ReportWriter, type PluginStore } from '@crawlith/core';

export const PageRankPlugin: CrawlPlugin = {
  name: 'pagerank',
  cli: {
    flag: 'pagerank',
    description: 'Calculates the authority of each page using the PageRank algorithm',
    defaultFor: ['crawl']
  },

  storage: {
    perPage: {
      columns: {
        score: 'REAL',
        raw_rank: 'REAL'
      }
    }
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      computePageRank(ctx.graph);

      const nodes = ctx.graph.getNodes();
      let totalScore = 0;
      let evaluatedCount = 0;
      let topPage: { url: string; score: number } | null = null;

      for (const node of nodes) {
        if (node.pageRankScore !== undefined) {
          ctx.store.upsertPageData(node.url, {
            score: node.pageRankScore,
            raw_rank: node.pageRank
          });

          totalScore += node.pageRankScore;
          evaluatedCount++;

          if (!topPage || node.pageRankScore > topPage.score) {
            topPage = { url: node.url, score: node.pageRankScore };
          }
        }
      }

      ctx.store.saveSummary({
        avgScore: evaluatedCount > 0 ? Math.round(totalScore / evaluatedCount) : 0,
        evaluatedCount,
        topPage
      });
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<any>();
      if (!summary) return;

      ctx.report.addSection('PageRank Authority', {
        metrics: {
          'Average PR': summary.avgScore,
          'Top Page': summary.topPage?.url
        },
        headers: ['Metric', 'Value'],
        rows: [
          ['Average Score', `${summary.avgScore}/100`],
          ['Pages Evaluated', summary.evaluatedCount],
          ['Top Authority Page', summary.topPage?.url || 'N/A']
        ]
      });
    }
  }
};

export default PageRankPlugin;
