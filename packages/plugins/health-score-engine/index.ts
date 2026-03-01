import type { CrawlPlugin, PluginContext, CLIWriter, ReportWriter, PluginStore } from '@crawlith/core';
import {
  calculateMetrics,
  buildCrawlInsightReport,
  hasCriticalIssues,
  renderScoreBreakdown
} from '@crawlith/core';
import chalk from 'chalk';

export const HealthScoreEnginePlugin: CrawlPlugin = {
  name: 'health-score-engine',
  cli: {
    flag: 'health',
    description: 'Intelligence engine to calculate global site health and SEO scores',
    defaultFor: ['crawl', 'page'],
    options: [
      { flags: "--fail-on-critical", description: "exit code 1 if critical issues exist" },
      { flags: "--score-breakdown", description: "print health score component weights" }
    ]
  },

  hooks: {
    async onMetrics(ctx: PluginContext & { cli: CLIWriter; store: PluginStore; graph?: any }) {
      if (!ctx.graph) return;

      const metrics = calculateMetrics(ctx.graph, 10);
      const insightReport = buildCrawlInsightReport(ctx.graph, metrics);

      ctx.store.saveSummary({
        score: insightReport.health.score,
        status: insightReport.health.status,
        components: insightReport.health.components,
        hasCritical: hasCriticalIssues(insightReport)
      });

      if (ctx.flags?.['fail-on-critical'] && hasCriticalIssues(insightReport)) {
        ctx.cli.error('\n❌ Fail-on-critical: Critical issues detected in the crawl.');
        process.exit(1);
      }
    },

    async onReport(ctx: PluginContext & { report: ReportWriter; store: PluginStore; cli?: CLIWriter }) {
      const summary = ctx.store.loadSummary<any>();
      if (!summary) return;

      if (ctx.flags?.['score-breakdown'] && ctx.cli) {
        ctx.cli.info('\n' + renderScoreBreakdown({
          score: summary.score,
          status: summary.status,
          components: summary.components
        }));
      }

      ctx.report.addSection('Health Score Analysis', {
        metrics: {
          'Score': summary.score,
          'Status': summary.status.toUpperCase()
        },
        headers: ['Component', 'Score', 'Status'],
        rows: Object.entries(summary.components).map(([name, data]: [string, any]) => [
          name.replace(/_/g, ' ').toUpperCase(),
          data.score,
          data.status.toUpperCase()
        ])
      });
    }
  },

  // Legacy support for single-page analysis if needed, or we could refactor that too
  onAnalyzeDone: async (result: any, ctx: any) => {
    const flags = ctx.flags || {};
    if (flags.failOnCritical) {
      const score = result.site_summary?.site_score;
      if (score !== undefined && score < 50) {
        console.error(chalk.red(`\n❌ CRITICAL FAILURE: Overall health score is ${score}, which is below the passing threshold of 50.`));
        process.exit(1);
      }
    }
  }
};

export default HealthScoreEnginePlugin;

