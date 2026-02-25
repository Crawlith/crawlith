import { Command } from 'commander';
import chalk from 'chalk';
import open from 'open';
import fs from 'node:fs';
import { startServer } from '@crawlith/server';
// @ts-ignore
import { distPath } from '@crawlith/web';

export const ui = new Command('ui')
  .description('Start the Crawlith UI Dashboard')
  .option('--site <url>', 'Site URL to display in dashboard', 'https://example.com')
  .option('--port <number>', 'Port to run server on', '23484')
  .action(async (options) => {
    try {
      const port = parseInt(options.port, 10);
      const siteUrl = options.site;

      console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith UI`));

      if (!fs.existsSync(distPath)) {
        console.error(chalk.red(`❌ Web build not found at ${distPath}.`));
        console.error(chalk.yellow('   Please run "npm run build" in plugins/web first.'));
        process.exit(1);
      }

      await startServer({
        port,
        staticPath: distPath,
        siteName: siteUrl
      });

      const url = `http://localhost:${port}`;
      console.log(chalk.green(`\n✅ Dashboard ready at: ${chalk.underline(url)}`));
      console.log(chalk.gray('   Press Ctrl+C to stop.'));

      await open(url);

    } catch (error) {
      console.error(chalk.red('\n❌ Error starting UI:'), error);
      process.exit(1);
    }
  });
