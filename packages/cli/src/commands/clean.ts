import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {
    getDb,
    SiteRepository,
    SnapshotRepository,
    PluginRegistry
} from '@crawlith/core';

export const getCleanCommand = (registry: PluginRegistry) => {
    const clean = new Command('clean')
        .description('Clean crawl data, exports, or snapshots for a site')
        .argument('[url]', 'URL or domain of the site to clean')
        .option('--exports', 'Clean exported files only')
        .option('--db', 'Clean database entries only (site, snapshots, pages)')
        .option('--snapshot <id>', 'Clean a specific snapshot by ID')
        .option('-y, --yes', 'Skip confirmation prompt');
    // Let plugins register their flags on this command
    registry.registerPlugins(clean);

    clean.action(async (url: string, options: any) => {
        try {
            if (!url) {
                console.error(chalk.red('\n❌ Error: URL argument is required\n'));
                clean.outputHelp();
                process.exit(1);
            }

            const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
            const domain = urlObj.hostname;
            const domainFolder = domain.replace('www.', ''); // Standardize folder name as done in export/crawl

            const db = getDb();
            const siteRepo = new SiteRepository(db);
            const snapshotRepo = new SnapshotRepository(db);

            const site = siteRepo.getSite(domain);
            if (!site && (options.db || options.snapshot)) {
                console.error(chalk.red(`❌ Site not found in database: ${domain}`));
                process.exit(1);
            }

            // Determine scope
            const cleanExports = options.exports || (!options.db && !options.snapshot);
            const cleanDb = options.db || (!options.exports && !options.snapshot);
            const cleanSnapshotId = options.snapshot ? parseInt(options.snapshot, 10) : null;

            if (cleanSnapshotId && isNaN(cleanSnapshotId)) {
                console.error(chalk.red('❌ Error: Snapshot ID must be a number'));
                process.exit(1);
            }

            // Construct warning message
            const actions: string[] = [];
            if (cleanSnapshotId) actions.push(`Delete Snapshot #${cleanSnapshotId} for ${domain}`);
            if (cleanDb && !cleanSnapshotId) actions.push(`Delete ALL database records for ${domain}`);
            if (cleanExports) actions.push(`Delete ALL exported reports for ${domain}`);

            console.log(chalk.bold.yellow('\n⚠️  Destructive Action ⚠️'));
            actions.forEach(action => console.log(chalk.yellow(` - ${action}`)));
            console.log('');

            if (!options.yes) {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise<string>(resolve => {
                    rl.question(chalk.bold('Are you sure you want to continue? (y/N) '), resolve);
                });
                rl.close();

                if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                    console.log(chalk.gray('Operation cancelled.'));
                    process.exit(0);
                }
            }

            // Execute Cleaning
            if (cleanSnapshotId) {
                if (!site) {
                    console.error(chalk.red(`❌ Site not found in database: ${domain}`));
                    process.exit(1);
                }
                const snapshot = snapshotRepo.getSnapshot(cleanSnapshotId);
                if (!snapshot) {
                    console.error(chalk.red(`❌ Snapshot #${cleanSnapshotId} not found`));
                    process.exit(1);
                }
                if (snapshot.site_id !== site.id) {
                    console.error(chalk.red(`❌ Snapshot #${cleanSnapshotId} does not belong to ${domain}`));
                    process.exit(1);
                }

                snapshotRepo.deleteSnapshot(cleanSnapshotId);
                console.log(chalk.green(`✅ Deleted Snapshot #${cleanSnapshotId}`));
            }

            if (cleanDb && !cleanSnapshotId) {
                if (site) {
                    siteRepo.deleteSite(site.id);
                    console.log(chalk.green(`✅ Deleted all database records for ${domain}`));
                } else {
                    console.log(chalk.yellow(`ℹ️  No database records found for ${domain}`));
                }
            }

            if (cleanExports) {
                const outputDir = path.resolve(options.output || './crawlith-reports');
                const siteExportDir = path.join(outputDir, domainFolder);
                try {
                    await fs.rm(siteExportDir, { recursive: true, force: true });
                    console.log(chalk.green(`✅ Deleted exported files in ${siteExportDir}`));
                } catch (e) {
                    console.error(chalk.red(`❌ Failed to delete exports: ${(e as Error).message}`));
                }
            }

            console.log(chalk.gray('\nClean operation completed.\n'));

        } catch (error) {
            console.error(chalk.red('❌ Clean failed:'), error);
            process.exit(1);
        }
    });

    return clean;
};