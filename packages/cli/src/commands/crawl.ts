import { Command } from 'commander';
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
    .option('--log-level <level>', 'Log level (normal, verbose, debug)', 'normal')
    .option('--force', 'force run (override existing lock)');

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
