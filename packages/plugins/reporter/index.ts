
import {
    CrawlithPlugin,
    PluginContext,
    calculateMetrics,
    buildCrawlInsightReport,
    renderInsightOutput
} from '@crawlith/core';
import chalk from 'chalk';
import { Command } from '@crawlith/core';

/**
 * Reporter Plugin
 * Crawlith plugin for reporter
 */
export const ReporterPlugin: CrawlithPlugin = {
    name: 'reporter',
    register: (_cli: Command) => {
        // Default for crawl in original, no new flags added.
    },

    hooks: {
        onReport: async (ctx: PluginContext, result: any) => {
            const flags = ctx.flags || {};
            const isCrawl = !!result.snapshotId && !!result.graph;

            if (!isCrawl) return; // Reporter only handles crawl reports for now

            const { graph, snapshotId } = result;
            const metrics = calculateMetrics(graph, 10);
            const healthData = result.plugins?.health;

            if (String(flags.format) === 'json') {
                const insightReport = buildCrawlInsightReport(graph, metrics, healthData);
                process.stdout.write(JSON.stringify(insightReport, null, 2));
                return;
            }

            process.stdout.write(chalk.gray('📊 Calculating final report metrics... '));
            process.stdout.write(chalk.green('Done\n'));

            const insightReport = buildCrawlInsightReport(graph, metrics, healthData);
            process.stdout.write(renderInsightOutput(insightReport, snapshotId));

            if (flags.verbose) {
                console.log(chalk.bold('\nVerbose Crawl Stats'));
                console.log(`Fetched: ${graph.sessionStats.pagesFetched}`);
                console.log(`Cached: ${graph.sessionStats.pagesCached}`);
                console.log(`Skipped: ${graph.sessionStats.pagesSkipped}`);
                console.log(`Total Found: ${graph.sessionStats.totalFound}`);
            }

            console.log("\n💾 run `crawlith ui` to view the full report");
            console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
        }
    }
};

export default ReporterPlugin;
