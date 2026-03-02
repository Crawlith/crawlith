import { Command } from 'commander';
import chalk from 'chalk';
import { getDb, SiteRepository, SnapshotRepository, PluginRegistry } from '@crawlith/core';

export const getSitesCommand = (registry: PluginRegistry) => {
  const sites = new Command('sites')
    .description('List all tracked sites and their latest snapshot summary.')
    .option('--format <type>', 'Output format (pretty, json)', 'pretty');

  registry.registerPlugins(sites);

  sites.action(async (options: any) => {
    try {
      const db = getDb();
      const siteRepo = new SiteRepository(db);
      const snapshotRepo = new SnapshotRepository(db);

      const allSites = siteRepo.getAllSites();
      const results = [];

      for (const site of allSites) {
        const snapshotCount = snapshotRepo.getSnapshotCount(site.id);
        const latestSnapshot = snapshotRepo.getLatestSnapshot(site.id);

        results.push({
          domain: site.domain,
          snapshots: snapshotCount,
          lastCrawl: latestSnapshot ? latestSnapshot.created_at : null,
          pages: latestSnapshot ? latestSnapshot.node_count : 0,
          health: latestSnapshot ? latestSnapshot.health_score : null
        });
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else {
        if (results.length === 0) {
          console.log(chalk.gray('No sites found. Run a crawl first to add sites.'));
          return;
        }

        results.forEach((site) => {
          console.log(chalk.bold(site.domain));
          console.log(`  ${chalk.gray('Snapshots:')} ${site.snapshots}`);

          let dateStr = 'Never';
          if (site.lastCrawl) {
            // Basic ISO date cleaning if needed, or just print as stored
            dateStr = site.lastCrawl.split('T')[0];
          }
          console.log(`  ${chalk.gray('Last Crawl:')} ${dateStr}`);

          console.log(`  ${chalk.gray('Pages:')} ${site.pages.toLocaleString()}`);

          let healthStr = 'N/A';
          if (site.health !== null) {
            const score = site.health;
            if (score >= 75) healthStr = chalk.green(score);
            else if (score >= 50) healthStr = chalk.yellow(score);
            else healthStr = chalk.red(score);
          }
          console.log(`  ${chalk.gray('Health:')} ${healthStr}`);
          console.log(''); // Empty line between sites
        });
      }

    } catch (error) {
      console.error(chalk.red('Error listing sites:'), error);
      process.exit(1);
    }
  });

  return sites;
};
