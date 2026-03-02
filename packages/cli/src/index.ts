#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { getCrawlCommand } from './commands/crawl.js';
import { getPageCommand } from './commands/page.js';
import { ui } from './commands/ui.js';
import { probe } from './commands/probe.js';
import { sites } from './commands/sites.js';
import { clean } from './commands/clean.js';
import { version, pkg } from './utils/version.js';

import { PluginLoader } from '@crawlith/core';
import { PluginRegistry } from '@crawlith/core';

async function bootstrap() {
  const loader = new PluginLoader();
  const plugins = await loader.discover(process.cwd());
  const registry = new PluginRegistry(plugins);

  const program = new Command();

  // Initialize update notifier
  const notifier = updateNotifier({
    pkg,
    updateCheckInterval: 1000 * 60 * 60 * 12 // 12 hours
  });

  const isJson = process.argv.includes('--json') ||
    process.argv.includes('--format=json') ||
    (process.argv.indexOf('--format') !== -1 && process.argv[process.argv.indexOf('--format') + 1] === 'json');

  if (process.stdout.isTTY && !isJson) {
    notifier.notify();
  }

  program
    .name('crawlith')
    .description('Modular crawl intelligence engine for serious SEO analysis.')
    .version(version);

  // Register internal commands
  program.addCommand(getCrawlCommand(registry));
  program.addCommand(getPageCommand(registry));
  program.addCommand(ui);
  program.addCommand(probe);
  program.addCommand(sites);
  program.addCommand(clean);

  // Auto-register plugin flags
  registry.registerPlugins(program);

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
  if (process.argv.length <= 2) {
    console.log(chalk.cyanBright('\n' + banner));
    console.log(chalk.gray('Crawlith — Deterministic crawl intelligence.\n'));
    program.help();
  } else if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(chalk.cyanBright('\n' + banner));
    console.log(chalk.gray('Crawlith — Deterministic crawl intelligence.\n'));
  }

  program.parse(process.argv);
}

bootstrap().catch(err => {
  console.error(chalk.red('Fatal error during bootstrap:'), err);
  process.exit(1);
});
