import { Command } from 'commander';
import chalk from 'chalk';
import {
  calculateMetrics,
  CrawlSitegraph,
  LockManager,
  EngineContext,
  PluginManager
} from '@crawlith/core';
import { buildCrawlInsightReport } from './crawlFormatter.js';
import { OutputController } from '../output/controller.js';
import { resolveCommandPlugins, registerPluginFlags } from '../plugins.js';

export const crawlCommand = new Command('crawl')
  .description('Crawl an entire website and build its internal link graph, metrics, and SEO structure.')
  .argument('[url]', 'URL to crawl')
  .option('-l, --limit <number>', 'max pages', '500')
  .option('-d, --depth <number>', 'max click depth', '5')
  .option('-c, --concurrency <number>', 'max concurrent requests', '2')
  .option('--no-query', 'strip query params')
  .option('--sitemap [url]', 'sitemap URL (defaults to /sitemap.xml if not specified)')

  .option('--log-level <level>', 'Log level (normal, verbose, debug)', 'normal')
  .option('--force', 'force run (override existing lock)');


registerPluginFlags(crawlCommand, 'crawl');

crawlCommand
  .action(async (url: string, options: any) => {

    if (!url) {
      console.error(chalk.red('\n❌ Error: URL argument is required for crawling\n'));
      crawlCommand.outputHelp();
      process.exit(0);
    }

    if (options.debug) options.logLevel = 'debug';
    if (options.verbose) options.logLevel = 'verbose';

    // 2. Initialize Controller
    const controller = new OutputController({
      format: options.format as any,
      logLevel: options.logLevel as any
    });
    const context: EngineContext = {
      emit: (e) => controller.handle(e)
    };

    const activePlugins = resolveCommandPlugins('crawl', options as Record<string, boolean>);
    context.emit({ type: 'debug', message: `Active plugins: ${activePlugins.map(p => p.name).join(', ')}` });

    const pm = new PluginManager(activePlugins, {
      debug: (message: string) => context.emit({ type: 'debug', message })
    });
    const pluginCtx: any = { command: 'crawl', flags: options as Record<string, boolean> };
    await pm.init(pluginCtx);
    if (pluginCtx.terminate) return;

    try {

      if (!url) {
        controller.handle({ type: 'error', message: 'Error: URL argument is required for crawling' });
        process.exit(1);
      }

      // Acquire process lock
      await LockManager.acquireLock('crawl', url, options, context, options.force);

      if (options.format !== 'json') {
        console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith Site Crawler`));
        console.log(`${chalk.gray('Target:')} ${chalk.blueBright(url)}`);
        console.log(`${chalk.gray('Limits:')} Pages: ${options.limit} | Depth: ${options.depth}\n`);
      }

      const limit = parseInt(options.limit, 10);
      const depth = parseInt(options.depth, 10);

      const stripQuery = !options.query;

      // Handle sitemap option
      let sitemap = options.sitemap;
      if (sitemap === true) {
        sitemap = 'true'; // trigger auto-discovery in crawl function
      }

      const crawlSitegraph = new CrawlSitegraph();
      const { graph } = await crawlSitegraph.execute({
        url,
        limit,
        depth,
        stripQuery,
        sitemap: sitemap as string | undefined,
        debug: options.logLevel === 'debug',
        concurrency: options.concurrency ? parseInt(options.concurrency, 10) : 2,
        plugins: activePlugins,
        context: {
          command: 'crawl',
          flags: options as Record<string, boolean>,
          logger: {
            info: (m: string) => context.emit({ type: 'debug', message: m }),
            warn: (m: string) => context.emit({ type: 'warn', message: m, context: undefined }),
            error: (m: string) => context.emit({ type: 'error', message: m, error: null })
          },
          metadata: {
          }
        }
      });

      const metrics = calculateMetrics(graph, depth);
    } catch (error) {
      controller.handle({ type: 'error', message: 'Error', error });
      process.exit(1);
    }
  });
