import { Command, Option } from 'commander';
import updateNotifier from 'update-notifier';
import { PluginLoader, PluginRegistry } from '@crawlith/core';
import { getCrawlCommand } from './commands/crawl.js';
import { getPageCommand } from './commands/page.js';
import { getUiCommand } from './commands/ui.js';
import { getProbeCommand } from './commands/probe.js';
import { getSitesCommand } from './commands/sites.js';
import { getCleanCommand } from './commands/clean.js';
import { getResetCommand } from './commands/reset.js';
import { getExportCommand } from './commands/export.js';
import { getCompletionCommand, getInternalCompleteCommand } from './commands/completion.js';
import { pkg, version } from './utils/version.js';
import { CommandRegistry } from './registry/commandRegistry.js';

/**
 * Create and configure the Crawlith CLI command tree.
 */
export async function buildProgram(): Promise<{ program: Command; commandRegistry: CommandRegistry }> {
  const loader = new PluginLoader();
  const plugins = await loader.discover(process.cwd());
  const pluginRegistry = new PluginRegistry(plugins);

  const program = new Command();
  program
    .name('crawlith')
    .description('Modular crawl intelligence engine for serious SEO analysis.')
    .version(version)
    .addOption(new Option('--format <type>', 'Output format').choices(['pretty', 'json']).default('pretty'))
    .option('--debug', 'Enable debug logging')
    .option('--verbose', 'Enable verbose logging');

  const commandRegistry = new CommandRegistry(program, pluginRegistry);

  program.addCommand(getCrawlCommand(pluginRegistry));
  program.addCommand(getPageCommand(pluginRegistry));
  program.addCommand(getUiCommand(pluginRegistry));
  program.addCommand(getProbeCommand(pluginRegistry));
  program.addCommand(getSitesCommand(pluginRegistry));
  program.addCommand(getCleanCommand(pluginRegistry));
  program.addCommand(getResetCommand(pluginRegistry));
  program.addCommand(getExportCommand(pluginRegistry));
  program.addCommand(getCompletionCommand());
  program.addCommand(getInternalCompleteCommand(commandRegistry), { hidden: true });

  pluginRegistry.registerPlugins(program);

  return { program, commandRegistry };
}

/**
 * Display update notifications when interactive and human-facing.
 */
export function maybeNotifyForUpdates(argv: string[]): void {
  const isJson = argv.includes('--json') ||
    argv.includes('--format=json') ||
    (argv.indexOf('--format') !== -1 && argv[argv.indexOf('--format') + 1] === 'json');
  const isCompletionInvocation = argv.includes('__complete') || argv.includes('completion');

  if (!process.stdout.isTTY || isJson || isCompletionInvocation) {
    return;
  }

  const notifier = updateNotifier({
    pkg,
    updateCheckInterval: 1000 * 60 * 60 * 12
  });
  notifier.notify();
}

