import { CrawlithPlugin, PluginContext, compareGraphs, Graph, SiteRepository, SnapshotRepository, getDb, loadGraphFromSnapshot } from '@crawlith/core';
import fs from 'node:fs/promises';
import chalk from 'chalk';
import { Command } from 'commander';

export const SnapshotDiffPlugin: CrawlithPlugin = {
  name: 'snapshot-diff',
  version: '1.0.0',

  register: (cli: Command) => {
    if (cli.name() === 'crawl') {
      cli
        .option("--incremental", "incremental crawl using previous snapshot")
        .option("--compare <files...>", "internal: compare two graph JSON files");
    }
  },

  hooks: {
    onInit: async (ctx: PluginContext) => {
      const flags = ctx.flags || {};
      if (flags.compare) {
        const files = flags.compare as unknown as string[];
        if (files.length !== 2) {
          console.error(chalk.red('Error: --compare requires exactly two file paths (old.json new.json)'));
          process.exit(1);
        }
        const [oldFile, newFile] = files;
        const fmt = typeof flags.format === 'string' ? flags.format : undefined;

        if (fmt !== 'json') {
          console.log(chalk.cyan(`\n🔍 Comparing Graphs`));
          console.log(`${chalk.gray('Old:')} ${oldFile}`);
          console.log(`${chalk.gray('New:')} ${newFile}\n`);
        }

        const oldJson = JSON.parse(await fs.readFile(oldFile, 'utf-8'));
        const newJson = JSON.parse(await fs.readFile(newFile, 'utf-8'));

        const oldGraph = Graph.fromJSON(oldJson);
        const newGraph = Graph.fromJSON(newJson);

        const diffResult = compareGraphs(oldGraph, newGraph);

        if (fmt !== 'json') {
          console.log(chalk.bold('📈 Comparison Results:'));
          console.log(`- Added URLs:   ${chalk.green(diffResult.addedUrls.length)}`);
          console.log(`- Removed URLs: ${chalk.red(diffResult.removedUrls.length)}`);
          console.log(`- Status Changes: ${chalk.yellow(diffResult.changedStatus.length)}`);

          console.log(chalk.bold('\n📉 Metric Deltas:'));
          Object.entries(diffResult.metricDeltas).forEach(([metric, delta]) => {
            const deltaStr = (delta as number) > 0 ? chalk.green(`+${(delta as number).toFixed(3)}`) : ((delta as number) < 0 ? chalk.red((delta as number).toFixed(3)) : chalk.gray('0'));
            console.log(`  ${metric.padEnd(20)}: ${deltaStr}`);
          });

          console.log('\n' + chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n');
        } else {
          console.log(JSON.stringify(diffResult, null, 2));
        }
        ctx.terminate = true;
      }
    },
    onCrawlStart: async (ctx: PluginContext) => {
      const flags = ctx.flags || {};

      if (flags.incremental) {
        ctx.logger?.info('🔍 Resolving previous snapshot for incremental crawl...');
        const targetUrl = flags.url || (ctx as any).url;

        if (!targetUrl || targetUrl.startsWith('-')) {
          return;
        }

        const db = getDb();
        const siteRepo = new SiteRepository(db);
        const snapRepo = new SnapshotRepository(db);

        try {
          const urlObj = new URL(targetUrl);
          const domain = urlObj.hostname.replace('www.', '');
          const site = siteRepo.getSite(domain);
          if (site) {
            const latestSnap = snapRepo.getLatestSnapshot(site.id, 'completed');
            if (latestSnap) {
              ctx.logger?.info(`Found previous snapshot #${latestSnap.id}, loading graph for delta comparison...`);
              if (!ctx.metadata) ctx.metadata = {};
              ctx.metadata.previousGraph = loadGraphFromSnapshot(latestSnap.id);
            }
          }
        } catch (_e) {
          // ignore url parsing failures
        }
      }
    }
  }
};

export default SnapshotDiffPlugin;
