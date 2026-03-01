import { Command } from 'commander';
import chalk from 'chalk';
import {
    getDb,
    SiteRepository,
    SnapshotRepository,
    loadGraphFromSnapshot,
    calculateMetrics
} from '@crawlith/core';
import { parseExportFormats, runCrawlExports } from '../utils/exportRunner.js';
import path from 'node:path';

export const exportCmd = new Command('export')
    .description('Export latest snapshot data for a site')
    .argument('[url]', 'URL or domain of the site')
    .option('-o, --output <path>', 'Output directory (e.g. ./crawlith-reports)', './crawlith-reports')
    .option('--export [formats]', 'Export formats (comma-separated: json,markdown,csv,html,visualize)', 'json')
    .action(async (url, options) => {
        if (!url) {
            console.error(chalk.red('\n❌ Error: URL argument is required for export\n'));
            exportCmd.outputHelp();
            process.exit(0);
        }
        try {
            if (!url) {
                console.error(chalk.red('\n❌ Error: URL argument is required for export\n'));
                exportCmd.outputHelp();
                process.exit(0);
            }

            const db = getDb();
            const siteRepo = new SiteRepository(db);
            const snapshotRepo = new SnapshotRepository(db);

            const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
            const domain = urlObj.hostname;
            const site = siteRepo.getSite(domain);

            if (!site) {
                console.error(chalk.red(`❌ Site not found in database: ${domain}`));
                process.exit(1);
            }

            const snapshot = snapshotRepo.getLatestSnapshot(site.id, 'completed');
            if (!snapshot) {
                console.error(chalk.red(`❌ No completed snapshots found for site: ${domain}`));
                process.exit(1);
            }

            console.log(chalk.cyan(`Exporting snapshot #${snapshot.id} for ${domain}...`));

            const graph = loadGraphFromSnapshot(snapshot.id);
            const maxDepth = Math.max(...graph.getNodes().map((n: any) => n.depth), 0);
            const metrics = calculateMetrics(graph, maxDepth);

            const outputDir = path.join(path.resolve(options.output), domain);

            const exportFormats = parseExportFormats(options.export);
            if (exportFormats.length > 0) {
                await runCrawlExports(
                    exportFormats,
                    outputDir,
                    url,
                    graph.toJSON(),
                    metrics,
                    graph
                );
                console.log(chalk.green(`✅ Exported successfully to ${outputDir}`));
            } else {
                console.log(chalk.yellow(`No export formats specified. Use --export json,html,etc.`));
            }
        } catch (error) {
            console.error(chalk.red('❌ Export failed:'), error);
            process.exit(1);
        }
    });
