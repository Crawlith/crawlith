#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { sitegraph } from './commands/sitegraph.js';
import { analyze } from './commands/analyze.js';
import { ui } from './commands/ui.js';
import { audit } from './commands/audit.js';
import { exportCmd } from './commands/export.js';
import { version } from '@crawlith/core';

const program = new Command();

program
  .name('crawlith')
  .description('A Node.js + TypeScript CLI tool for crawling websites and generating internal link graphs.')
  .version(version)
  .addCommand(sitegraph)
  .addCommand(analyze)
  .addCommand(ui)
  .addCommand(audit)
  .addCommand(exportCmd);

// show a nice title on help or when no arguments
if (process.argv.length <= 2 || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(chalk.bold.blue('\n◢  CRAWLITH  ◣'));
  console.log(chalk.gray('The lightweight SEO Link Graph & Analysis Tool\n'));
}

program.parse(process.argv);
