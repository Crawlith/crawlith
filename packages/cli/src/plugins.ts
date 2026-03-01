import type { CrawlPlugin } from '@crawlith/core';
import { resolvePlugins } from '@crawlith/core';

// Import canonical plugin implementations from their own packages
import { PageRankPlugin } from '@crawlith/plugin-pagerank';
import { HitsPlugin } from '@crawlith/plugin-hits';
import { DuplicateDetectionPlugin } from '@crawlith/plugin-duplicate-detection';
import { ContentClusteringPlugin } from '@crawlith/plugin-content-clustering';
import { SimhashPlugin } from '@crawlith/plugin-simhash';
import { HeadingHealthPlugin } from '@crawlith/plugin-heading-health';

export const allPlugins: CrawlPlugin[] = [
  PageRankPlugin,
  HitsPlugin,
  DuplicateDetectionPlugin,
  ContentClusteringPlugin,
  SimhashPlugin,
  HeadingHealthPlugin,
];

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
