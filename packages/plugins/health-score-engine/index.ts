import type { CrawlPlugin, CrawlContext } from '@crawlith/core';
import {
  calculateMetrics,
  buildCrawlInsightReport,
  hasCriticalIssues,
  renderScoreBreakdown
} from '@crawlith/core';
import chalk from 'chalk';

export const HealthScoreEnginePlugin: CrawlPlugin = {
  name: 'HealthScoreEnginePlugin',
  cli: {
    defaultFor: ['crawl', 'page'],
    options: [
      { flags: "--fail-on-critical", description: "exit code 1 if critical issues exist" },
      { flags: "--score-breakdown", description: "print health score component weights" }
    ]
  },
  onAfterCrawl: async (ctx: CrawlContext) => {
    const flags = ctx.flags || {};
    const graph = ctx.graph;
    const snapshotId = ctx.snapshotId;

    if (!graph || !snapshotId) return;

    if (!flags.failOnCritical && !flags.scoreBreakdown) {
      return;
    }

    const metrics = calculateMetrics(graph, 10); // Use a default depth for final metrics
    const insightReport = buildCrawlInsightReport(graph, metrics);

    if (flags.scoreBreakdown && String(flags.format) !== 'json') {
      console.log('\n' + renderScoreBreakdown(insightReport.health));
    }

    if (flags.failOnCritical && hasCriticalIssues(insightReport)) {
      console.error(chalk.red('\n❌ Fail-on-critical: Critical issues detected in the crawl. Exiting.'));
      process.exit(1);
    }
  },
  onAnalyzeDone: async (result: any, ctx: any) => {
    const flags = ctx.flags || {};

    if (!flags.failOnCritical && !flags.scoreBreakdown) {
      return;
    }

    if (flags.scoreBreakdown && result.pages && result.pages.length > 0 && String(flags.format) !== 'json') {
      console.log(chalk.cyan('\n🩺 Health Score Breakdown (First Page Sample):'));
      const sample = result.pages[0];
      console.log(`  Overall SEO Score: ${sample.seoScore}`);

      const titleStatus = sample.title.status;
      const h1Status = sample.h1.status;
      const words = sample.content.wordCount;
      const thinScore = sample.thinScore;

      console.log(`  Title: ${titleStatus === 'ok' ? chalk.green(titleStatus) : chalk.yellow(titleStatus)}`);
      console.log(`  H1: ${h1Status === 'ok' ? chalk.green(h1Status) : chalk.yellow(h1Status)}`);
      console.log(`  Word Count: ${words}`);
      console.log(`  Thin Content Penalty: ${thinScore}%`);
    }

    if (flags.failOnCritical) {
      // Analyze site_scores to see if it failed
      const score = result.site_summary?.site_score;
      if (score !== undefined && score < 50) {
        console.error(chalk.red(`\n❌ CRITICAL FAILURE: Overall health score is ${score}, which is below the passing threshold of 50.`));
        process.exit(1);
      }
    }
  }
};
