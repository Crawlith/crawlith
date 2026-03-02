import {
  CrawlithPlugin,
  PluginContext,
  calculateMetrics,
  buildCrawlInsightReport,
  hasCriticalIssues,
  renderScoreBreakdown
} from '@crawlith/core';
import chalk from 'chalk';
import { Command } from 'commander';

export const HealthScoreEnginePlugin: CrawlithPlugin = {
  name: 'health-score-engine',
  version: '1.0.0',

  register: (cli: Command) => {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
      cli
        .option("--fail-on-critical", "exit code 1 if critical issues exist")
        .option("--score-breakdown", "print health score component weights");
    }
  },

  hooks: {
    onReport: async (ctx: PluginContext, result: any) => {
      const flags = ctx.flags || {};
      const isCrawl = !!result.snapshotId && !!result.graph;

      if (!flags.failOnCritical && !flags.scoreBreakdown) {
        return;
      }

      if (isCrawl) {
        const { graph, snapshotId: _snapshotId } = result;
        const metrics = calculateMetrics(graph, 10);
        const insightReport = buildCrawlInsightReport(graph, metrics);

        if (flags.scoreBreakdown && String(flags.format) !== 'json') {
          console.log('\n' + renderScoreBreakdown(insightReport.health));
        }

        if (flags.failOnCritical && hasCriticalIssues(insightReport)) {
          console.error(chalk.red('\n❌ Fail-on-critical: Critical issues detected in the crawl. Exiting.'));
          process.exit(1);
        }
      } else {
        // Analysis result
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
          const score = result.site_summary?.site_score;
          if (score !== undefined && score < 50) {
            console.error(chalk.red(`\n❌ CRITICAL FAILURE: Overall health score is ${score}, which is below the passing threshold of 50.`));
            process.exit(1);
          }
        }
      }
    }
  }
};

export default HealthScoreEnginePlugin;
