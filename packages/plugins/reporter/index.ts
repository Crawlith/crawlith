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

        if (ctx.report && ctx.report.plugins && Object.keys(ctx.report.plugins).length > 0) {
            console.log(chalk.bold.magenta('🧩 Plugin Insights'));
            for (const [key, pluginData] of Object.entries(ctx.report.plugins)) {
                const title = key.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                let metricsOut = '';
                if (pluginData && typeof pluginData === 'object' && 'metrics' in pluginData && pluginData.metrics) {
                    const entries = Object.entries(pluginData.metrics as Record<string, any>);
                    if (entries.length > 0) {
                        metricsOut = entries.map(([mKey, mVal]) => {
                            const fKey = mKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => (str as string).toUpperCase());
                            return `${chalk.gray(fKey)} ${chalk.yellow(mVal)}`;
                        }).join('  •  ');
                    }
                }

                console.log(`  ${chalk.cyan('■')} ${chalk.bold(title)}`);
                if (metricsOut) {
                    console.log(`    ${metricsOut}`);
                }
            }
            console.log('');
        }

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
