import type { CrawlPlugin, CrawlContext } from '@crawlith/core';
import {
    calculateMetrics,
    buildCrawlInsightReport,
    renderInsightOutput
} from '@crawlith/core';
import chalk from 'chalk';

export const ReporterPlugin: CrawlPlugin = {
    name: 'ReporterPlugin',
    cli: {
        defaultFor: ['crawl'],
        options: []
    },
    onAfterCrawl: async (ctx: CrawlContext) => {
        const flags = ctx.flags || {};
        const graph = ctx.graph;
        const snapshotId = ctx.snapshotId;

        if (!graph || !snapshotId) return;

        const metrics = calculateMetrics(graph, 10);

        if (String(flags.format) === 'json') {
            const insightReport = buildCrawlInsightReport(graph, metrics);
            process.stdout.write(JSON.stringify(insightReport, null, 2));
            return;
        }

        process.stdout.write(chalk.gray('📊 Calculating final report metrics... '));
        process.stdout.write(chalk.green('Done\n'));

        const insightReport = buildCrawlInsightReport(graph, metrics);
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
};
