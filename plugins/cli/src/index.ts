#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { crawls } from './commands/crawl.js';
import { analyze } from './commands/page.js';
import { ui } from './commands/ui.js';
import { probe } from './commands/probe.js';
import { clean } from './commands/clean.js';
import { version } from './utils/version.js';

const program = new Command();

program
  .name('crawlith')
  .description('Modular crawl intelligence engine for serious SEO analysis.')
  .version(version)
  .addCommand(crawls)
  .addCommand(analyze)
  .addCommand(ui)
  .addCommand(probe)
  .addCommand(clean);

program.configureHelp({
  padWidth() {
    return 28;
  },
});


const banner = `
  ██████╗██████╗  █████╗ ██╗    ██╗██╗     ██╗████████╗██╗  ██╗ ${version}
 ██╔════╝██╔══██╗██╔══██╗██║    ██║██║     ██║╚══██╔══╝██║  ██║
 ██║     ██████╔╝███████║██║ █╗ ██║██║     ██║   ██║   ███████║
 ██║     ██╔══██╗██╔══██║██║███╗██║██║     ██║   ██║   ██╔══██║
 ╚██████╗██║  ██║██║  ██║╚███╔███╔╝███████╗██║   ██║   ██║  ██║
  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝
`;
// show a nice title on help or when no arguments
if (process.argv.length <= 2) {
  console.log(chalk.cyanBright('\n' + banner));
  console.log(chalk.gray('Crawlith — Deterministic crawl intelligence.\n'));
  program.help();
} else if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(chalk.cyanBright('\n' + banner));
  console.log(chalk.gray('Crawlith — Deterministic crawl intelligence.\n'));
}

program.parse(process.argv);