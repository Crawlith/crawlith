#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { sitegraphCommand } from './commands/crawl.js';
import { analyze } from './commands/page.js';
import { ui } from './commands/ui.js';
import { probe } from './commands/probe.js';
import { sites } from './commands/sites.js';
import { clean } from './commands/clean.js';
import { version, pkg } from './utils/version.js';

const program = new Command();

// Initialize update notifier
const notifier = updateNotifier({
  pkg,
  updateCheckInterval: 1000 * 60 * 60 * 12 // 12 hours
});

// Check if we should notify
// We need to be careful not to trigger on JSON output commands
const isJson = process.argv.includes('--json') ||
  process.argv.includes('--format=json') ||
  (process.argv.indexOf('--format') !== -1 && process.argv[process.argv.indexOf('--format') + 1] === 'json');

if (process.stdout.isTTY && !isJson) {
  notifier.notify();
}

program
  .name('crawlith')
  .description('Modular crawl intelligence engine for serious SEO analysis.')
  .version(version)
  .addCommand(sitegraphCommand)
  .addCommand(analyze)
  .addCommand(ui)
  .addCommand(probe)
  .addCommand(sites)
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
