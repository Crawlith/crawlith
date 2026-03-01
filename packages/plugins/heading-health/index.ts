import type { CrawlPlugin, PluginContext, CLIWriter, ReportWriter, PluginStore } from '@crawlith/core';
import { load } from 'cheerio';

function analyzeHeadingHealth(html?: string) {
  if (!html) return { score: 0, missing: 1, multiple: 0 };

  // Note: doing a regex is fast contextually, but cheerio parses are more standard if already using cheerio elsewhere.
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;

  let score = 0;
  if (h1Count !== 1) score = Math.max(0, 60 - Math.abs(h1Count - 1) * 20);
  else score = Math.min(100, 70 + Math.min(h2Count, 3) * 10);

  return {
    score,
    missing: h1Count === 0 ? 1 : 0,
    multiple: h1Count > 1 ? 1 : 0
  };
}

export const HeadingHealthPlugin: CrawlPlugin = {
  name: 'heading-health',
  cli: {
    flag: 'heading',
    description: 'Analyze heading structure',
    defaultFor: ['crawl'],
    optionalFor: ['page']
  },

  storage: {
    perPage: {
      columns: {
        score: 'INTEGER',
        missing_h1: 'INTEGER',
        multiple_h1: 'INTEGER'
      }
    }
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      let totalScore = 0;
      let evaluatedPages = 0;
      let totalMissing = 0;
      let totalMultiple = 0;

      for (const node of ctx.graph.getNodes()) {
        if (node.status < 200 || node.status >= 300 || !node.html) continue;

        const health = analyzeHeadingHealth(node.html);

        ctx.store.upsertPageData(node.url, {
          score: health.score,
          missing_h1: health.missing,
          multiple_h1: health.multiple
        });

        totalScore += health.score;
        evaluatedPages++;
        totalMissing += health.missing;
        totalMultiple += health.multiple;
      }

      const avgScore = evaluatedPages > 0 ? Math.round(totalScore / evaluatedPages) : 0;

      ctx.store.saveSummary({
        avgScore,
        evaluatedPages,
        totalMissing,
        totalMultiple
      });
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<{
        avgScore: number;
        evaluatedPages: number;
        totalMissing: number;
        totalMultiple: number;
      }>();

      if (!summary) return;

      ctx.report.addSection('Heading Health', {
        metrics: {
          'Missing H1': summary.totalMissing,
          'Multiple H1': summary.totalMultiple,
          'Avg Score': summary.avgScore
        },
        headers: ['Metric', 'Value'],
        rows: [
          ['Average Score', `${summary.avgScore}/100`],
          ['Pages Evaluated', summary.evaluatedPages],
          ['Missing H1s', summary.totalMissing],
          ['Multiple H1s', summary.totalMultiple]
        ]
      });

      if (ctx.report.contributeScore) {
        ctx.report.contributeScore({
          label: 'Heading Structure',
          score: summary.avgScore,
          weight: 0.1
        });
      }
    }
  }
};

export default HeadingHealthPlugin;
