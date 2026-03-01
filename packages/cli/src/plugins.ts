import type { CrawlPlugin } from '@crawlith/core';
import { builtinPlugins, resolvePlugins } from '@crawlith/core';

export const allPlugins: CrawlPlugin[] = builtinPlugins;

export function registerPluginFlags(command: any, commandName: string) {
  for (const plugin of allPlugins) {
    const cli = plugin.cli;
    if (!cli?.flag || !cli.optionalFor?.includes(commandName)) continue;
    command.option(`--${cli.flag}`, cli.description ?? `Enable ${plugin.name}`);
  }
}

export function resolveCommandPlugins(commandName: string, flags: Record<string, boolean>): CrawlPlugin[] {
  return resolvePlugins(allPlugins, commandName, flags);
}
