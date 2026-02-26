import { CommandModule } from 'yargs';
import chalk from 'chalk';
import open from 'open';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '@crawlith/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'ui');

export const uiCommand: CommandModule = {
  command: 'ui',
  describe: 'Start the Crawlith UI Dashboard',
  builder: (y) => {
    return y
      .option('site', {
        type: 'string',
        default: 'https://example.com',
        describe: 'Site URL to display in dashboard'
      })
      .option('port', {
        type: 'number',
        default: 23484,
        describe: 'Port to run server on'
      })
      .option('host', {
        type: 'string',
        default: '127.0.0.1',
        describe: 'Host to bind server to'
      });
  },
  handler: async (argv: any) => {
    try {
      const port = argv.port;
      const host = argv.host;
      const siteUrl = argv.site;

      console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith UI`));

      if (!fs.existsSync(distPath)) {
        console.error(chalk.red(`❌ Web build not found at ${distPath}.`));
        console.error(chalk.yellow('   Please run "npm run build" in plugins/web first.'));
        process.exit(1);
      }

      await startServer({
        port,
        host,
        staticPath: distPath,
        siteName: siteUrl
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
  }
};
