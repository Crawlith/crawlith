#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { sitegraphCommand } from './commands/sitegraph.js';
import { analyzeCommand } from './commands/analyze.js';
import { uiCommand } from './commands/ui.js';
import { auditCommand } from './commands/audit.js';
import { exportCommand } from './commands/export.js';
import { version } from '@crawlith/core';

// show a nice title on help or when no arguments
if (process.argv.length <= 2 || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(chalk.bold.blue('\n◢  CRAWLITH  ◣'));
  console.log(chalk.gray('The lightweight SEO Link Graph & Analysis Tool\n'));
}

yargs(hideBin(process.argv))
  .scriptName('crawlith')
  .version(version)
  .command(sitegraphCommand)
  .command(analyzeCommand)
  .command(uiCommand)
  .command(auditCommand)
  .command(exportCommand)
  .recommendCommands()
  .demandCommand(1, 'You need to specify a command')
  .strict()
  .completion()
  .help()
  .alias('h', 'help')
  .alias('v', 'version')
  .parse();
