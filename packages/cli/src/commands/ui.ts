import { Command } from 'commander';
import chalk from 'chalk';
import open from 'open';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '@crawlith/server';
import { getDb, SiteRepository, SnapshotRepository, PluginRegistry } from '@crawlith/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'ui');

export const getUiCommand = (registry: PluginRegistry) => {
  const ui = new Command('ui')
    .description('Start the Crawlith UI Dashboard')
    .argument('[url]', 'Site URL or domain to visualize')
    .option('--port [number]', 'Port to run server on', '23484')
    .option('--host [address]', 'Host to bind server to', '127.0.0.1');

  registry.registerPlugins(ui);

  ui.action(async (siteUrl, options) => {
    if (!siteUrl) {
      console.error(chalk.red('❌ Missing required argument: url'));
      ui.outputHelp();
      process.exit(0);
    }
    try {
      const port = parseInt(options.port, 10);
      const host = options.host;

      console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith UI`));

      if (!fs.existsSync(distPath)) {
        console.error(chalk.red(`❌ Web build not found at ${distPath}.`));
        console.error(chalk.yellow('   Please run "pnpm --filter @crawlith/web build" first.'));
        process.exit(1);
      }

      // 1. Normalize domain
      let domain = siteUrl;
      try {
        const url = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
        domain = url.hostname;
      } catch (_e) {
        // use raw string if URL parsing fails
      }

      console.log(chalk.gray(`   Resolving site: ${domain}`));

      // 2. Connect to DB and resolve site/snapshot
      const db = getDb();
      const siteRepo = new SiteRepository(db);
      const snapshotRepo = new SnapshotRepository(db);

      const site = siteRepo.getSite(domain);
      if (!site) {
        console.error(chalk.red(`❌ Site not found: ${domain}`));
        console.error(chalk.yellow(`   Run "crawlith crawl ${domain}" first to generate data.`));
        process.exit(1);
      }

      const snapshot = snapshotRepo.getLatestSnapshot(site.id, 'completed');
      if (!snapshot) {
        console.error(chalk.red(`❌ No snapshots found for site: ${domain}`));
        process.exit(1);
      }

      // 3. Start Server with context
      await startServer({
        port,
        host,
        staticPath: distPath,
        siteId: site.id,
        snapshotId: snapshot.id
      });

      const displayHost = host === '0.0.0.0' ? 'localhost' : host;
      const url = `http://${displayHost}:${port}`;
      console.log(chalk.green(`\n✅ Dashboard ready at: ${chalk.underline(url)}`));
      console.log(chalk.gray('   Press Ctrl+C to stop.'));

      await open(url);

    } catch (error) {
      console.error(chalk.red('\n❌ Error starting UI:'), error);
      process.exit(1);
    }
  });

  return ui;
};
