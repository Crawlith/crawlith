import type { CrawlPlugin } from '@crawlith/core';
import { resolvePlugins } from '@crawlith/core';

import { PageRankPlugin } from '@crawlith/plugin-pagerank';
import { HitsPlugin } from '@crawlith/plugin-hits';
import { DuplicateDetectionPlugin } from '@crawlith/plugin-duplicate-detection';
import { ContentClusteringPlugin } from '@crawlith/plugin-content-clustering';
import { SimhashPlugin } from '@crawlith/plugin-simhash';
import { HeadingHealthPlugin } from '@crawlith/plugin-heading-health';
import { OrphanIntelligencePlugin } from '@crawlith/plugin-orphan-intelligence';
import { Soft404DetectorPlugin } from '@crawlith/plugin-soft404-detector';
import { CrawlTrapAnalyzerPlugin } from '@crawlith/plugin-crawl-trap-analyzer';
import { HealthScoreEnginePlugin } from '@crawlith/plugin-health-score-engine';
import { SnapshotDiffPlugin } from '@crawlith/plugin-snapshot-diff';
import { CrawlPolicyPlugin } from '@crawlith/plugin-crawl-policy';
import { ExporterPlugin } from '@crawlith/plugin-exporter';
import { ReporterPlugin } from '@crawlith/plugin-reporter';
import { PageAnalyzerPlugin } from '@crawlith/plugin-page-analyzer';


export const allPlugins: CrawlPlugin[] = [
  SimhashPlugin,
  PageRankPlugin,
  HitsPlugin,
  DuplicateDetectionPlugin,
  ContentClusteringPlugin,
  HeadingHealthPlugin,
  OrphanIntelligencePlugin,
  Soft404DetectorPlugin,
  CrawlTrapAnalyzerPlugin,
  HealthScoreEnginePlugin,
  SnapshotDiffPlugin,
  CrawlPolicyPlugin,
  ExporterPlugin,
  ReporterPlugin,
  PageAnalyzerPlugin,
];

/**
 * Dynamically registers CLI flags and options declared by plugins.
 *
 * For each plugin that is relevant to the given command:
 * - If the plugin has an opt-in toggle flag (optionalFor), register it
 * - If the plugin has options[], register each one on the command
 *
 * This is how plugins inject their own flags into crawl/page/etc
 * without the command needing to hardcode them.
 */
export function registerPluginFlags(command: any, commandName: string) {
  for (const plugin of allPlugins) {
    const cli = plugin.cli;
    if (!cli) continue;

    // Register the opt-in toggle flag (e.g. --compute-hits for HITS)
    if (cli.flag && cli.optionalFor?.includes(commandName)) {
      command.option(`--${cli.flag}`, cli.description ?? `Enable ${plugin.name}`);
    }

    // Register plugin-declared options (e.g. --cluster-threshold <number>)
    const isRelevant = cli.defaultFor?.includes(commandName) || cli.optionalFor?.includes(commandName);
    if (isRelevant && cli.options) {
      for (const opt of cli.options) {
        if (opt.defaultValue !== undefined) {
          command.option(opt.flags, opt.description, opt.defaultValue);
        } else {
          command.option(opt.flags, opt.description);
        }
      }
    }
  }
}

export function resolveCommandPlugins(commandName: string, flags: Record<string, boolean>): CrawlPlugin[] {
  return resolvePlugins(allPlugins, commandName, flags);
}
