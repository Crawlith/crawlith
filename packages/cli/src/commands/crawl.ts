import { Command, Option } from 'commander';
import chalk from 'chalk';
import {
  CrawlSitegraph,
  LockManager,
  EngineContext,
  PluginRegistry
} from '@crawlith/core';

import { OutputController } from '../output/controller.js';

export const getCrawlCommand = (registry: PluginRegistry) => {
  const crawlCommand = new Command('crawl')
    .description('Crawl an entire website and build its internal link graph, metrics, and SEO structure.')
    .argument('[url]', 'URL to crawl')
    .option('-l, --limit <number>', 'max pages', '500')
    .option('-d, --depth <number>', 'max click depth', '5')
    .option('-c, --concurrency <number>', 'max concurrent requests', '2')
    .option('--no-query', 'strip query params')
    .option('--sitemap [url]', 'sitemap URL (defaults to /sitemap.xml if not specified)')
    .addOption(new Option('--log-level [level]', 'Log level (normal, verbose, debug)').choices(['normal', 'verbose', 'debug']).default('normal'))
    .option('--force', 'force run (override existing lock)')
    .option('--allow <domains>', 'comma separated list of domains to allow')
    .option('--deny <domains>', 'comma separated list of domains to deny')
    .option('--include-subdomains', 'include subdomains in the default scope')
    .option('--ignore-robots', 'ignore robots.txt directives')
    .option('--proxy <url>', 'proxy URL to use for requests')
    .option('--ua <string>', 'user agent string to use')
    .option('--rate <number>', 'requests per second limit')
    .option('--max-bytes <number>', 'maximum bytes to download per page')
    .option('--max-redirects <number>', 'maximum redirects to follow')
    // Clustering (Moved from plugin to core)
    .option('--clustering', 'Enable content clustering analysis')
    .option('--cluster-threshold <number>', 'Hamming distance for content clusters', '10')
    .option('--min-cluster-size <number>', 'Minimum pages per cluster', '3')
    // Heading & Health (Moved from plugin to core)
    .option('--heading', 'Analyze heading structure and hierarchy health')
    .option('--health', 'Run health score analysis')
    .option('--fail-on-critical', 'Exit code 1 if critical issues exist')
    .option('--score-breakdown', 'Print health score component weights')
    // Graph Centrality
    .option('--compute-hits', 'Compute Hub and Authority scores (HITS)')
    .option('--compute-pagerank', 'Compute PageRank centrality scores')
    // Orphan Intelligence
    .option('--orphans', 'Detect orphaned pages')
    .option('--orphan-severity', 'Enable severity scoring for orphans')
    .option('--include-soft-orphans', 'Include pages with very few in-links as soft orphans')
    .option('--min-inbound <number>', 'Minimum inbound links to not be an orphan', '2');

  // Let plugins register their flags on this command
  registry.registerPlugins(crawlCommand);

  crawlCommand.action(async (url: string, options: any) => {
    if (!url) {
      console.error(chalk.red('\n❌ Error: URL argument is required for crawling\n'));
      crawlCommand.outputHelp();
      process.exit(0);
    }

    if (options.debug) options.logLevel = 'debug';
    if (options.verbose) options.logLevel = 'verbose';

    const controller = new OutputController({
      format: options.format as any,
      logLevel: options.logLevel as any
    });

    const context: EngineContext = {
      emit: (e) => controller.handle(e)
    };

    try {
      await LockManager.acquireLock('crawl', url, options, context, options.force);

      if (options.format !== 'json') {
        console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith Site Crawler`));
        console.log(`${chalk.gray('Target:')} ${chalk.blueBright(url)}`);
        console.log(`${chalk.gray('Limits:')} Pages: ${options.limit} | Depth: ${options.depth}\n`);
      }

      const limit = parseInt(options.limit, 10);
      const depth = parseInt(options.depth, 10);
      const stripQuery = !options.query;

      let sitemap = options.sitemap;
      if (sitemap === true) {
        sitemap = 'true';
      }

      const crawlSitegraph = new CrawlSitegraph();
      const { graph: _graph } = await crawlSitegraph.execute({
        url,
        limit,
        depth,
        stripQuery,
        sitemap: sitemap as string | undefined,
        debug: options.logLevel === 'debug',
        concurrency: options.concurrency ? parseInt(options.concurrency, 10) : 2,
        ignoreRobots: options.ignoreRobots,
        allowedDomains: options.allow ? options.allow.split(',').map((d: string) => d.trim()) : undefined,
        deniedDomains: options.deny ? options.deny.split(',').map((d: string) => d.trim()) : undefined,
        includeSubdomains: options.includeSubdomains,
        proxyUrl: options.proxy,
        userAgent: options.ua,
        rate: options.rate ? parseFloat(options.rate) : undefined,
        maxBytes: options.maxBytes ? parseInt(options.maxBytes, 10) : undefined,
        maxRedirects: options.maxRedirects ? parseInt(options.maxRedirects, 10) : undefined,
        clustering: options.clustering,
        clusterThreshold: options.clusterThreshold ? parseInt(options.clusterThreshold, 10) : undefined,
        minClusterSize: options.minClusterSize ? parseInt(options.minClusterSize, 10) : undefined,
        heading: options.heading,
        health: options.health,
        failOnCritical: options.failOnCritical,
        scoreBreakdown: options.scoreBreakdown,
        computeHits: options.computeHits,
        computePagerank: options.computePagerank,
        orphans: options.orphans,
        orphanSeverity: options.orphanSeverity,
        includeSoftOrphans: options.includeSoftOrphans,
        minInbound: options.minInbound ? parseInt(options.minInbound, 10) : undefined,
        plugins: registry.getPlugins(),
        context: {
          command: 'crawl',
          flags: options as Record<string, any>,
          logger: {
            info: (m: string) => context.emit({ type: 'info', message: m }),
            warn: (m: string) => context.emit({ type: 'warn', message: m, context: undefined }),
            error: (m: string) => context.emit({ type: 'error', message: m, error: null }),
            debug: (m: string) => context.emit({ type: 'debug', message: m })
          }
        }
      });

      // After crawl, we could do more here if needed, but CrawlSitegraph handles metrics phase hooks
      if (options.format !== 'json') {
        console.log(chalk.green('\n✅ Crawl completed successfully.'));
      }
    } catch (error) {
      if ((error as any).code === 'ELOCKED') {
        // Handled by LockManager
      } else {
        controller.handle({ type: 'error', message: 'Error during crawl', error: error as Error });
      }
      process.exit(1);
    }
  });

  return crawlCommand;
};
