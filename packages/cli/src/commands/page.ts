import { Command, Option } from 'commander';
import chalk from 'chalk';
import { PageAnalysisUseCase, EngineContext, PluginRegistry } from '@crawlith/core';
import { OutputController } from '../output/controller.js';
import {
  buildAnalyzeInsightReport,
  renderAnalyzeInsightOutput
} from './analyzeFormatter.js';

export const getPageCommand = (registry: PluginRegistry) => {
  const analyze = new Command('page')
    .description('Analyze a single URL for on-page SEO signals and content structure.')
    .argument('[url]', 'URL to analyze')
    .option('--live', 'Perform a live crawl before analysis')
    .addOption(new Option('--log-level <level>', 'Log level (normal, verbose, debug)').choices(['normal', 'verbose', 'debug']).default('normal'))
    .option('--seo', 'Show only SEO module output')
    .option('--content', 'Show only content module output')
    .option('--accessibility', 'Show only accessibility module output')
    // Crawl Policy
    .option('--proxy <url>', 'proxy URL to use for requests')
    .option('--ua <string>', 'user agent string to use')
    .option('--rate <number>', 'requests per second limit')
    .option('--max-bytes <number>', 'maximum bytes to download per page')
    .option('--max-redirects <number>', 'maximum redirects to follow')
    // Clustering
    .option('--clustering', 'Enable content clustering analysis')
    .option('--cluster-threshold <number>', 'Hamming distance for content clusters', '10')
    .option('--min-cluster-size <number>', 'Minimum pages per cluster', '3')
    .option('--sitemap [url]', 'sitemap URL (defaults to /sitemap.xml if not specified)')
    // Heading & Health
    .option('--heading', 'Analyze heading structure and hierarchy health')
    .option('--health', 'Run health score analysis')
    .option('--fail-on-critical', 'Exit code 1 if critical issues exist')
    .option('--score-breakdown', 'Print health score component weights')
    // Graph Centrality
    .option('--pagerank', 'Calculate PageRank')
    .option('--hits', 'Compute Hub and Authority scores (HITS)')
    // Orphans
    .option('--orphans', 'Detect orphaned pages')
    .option('--orphan-severity <value>', 'Severity for orphans (low/medium/high)')
    .option('--include-soft-orphans', 'Include soft orphans in detection')
    .option('--min-inbound <value>', 'Minimum inbound links to not be an orphan', '2');

  // Let plugins register their flags on this command
  registry.registerPlugins(analyze);

  analyze.action(async (url: string, options: any) => {
    if (!url) {
      console.error(chalk.red('\n❌ Error: URL argument is required for analysis\n'));
      analyze.outputHelp();
      process.exit(0);
    }

    if (options.debug) options.logLevel = 'debug';
    if (options.verbose) options.logLevel = 'verbose';

    const controller = new OutputController({
      format: options.format as any,
      logLevel: options.logLevel as any
    });

    const context: EngineContext = {
      emit: (event) => controller.handle(event)
    };

    try {
      const useCase = new PageAnalysisUseCase(context);
      const result = await useCase.execute({
        url,
        live: options.live,
        seo: options.seo,
        content: options.content,
        accessibility: options.accessibility,
        proxyUrl: options.proxy,
        userAgent: options.ua,
        rate: options.rate ? parseFloat(options.rate) : undefined,
        maxBytes: options.maxBytes ? parseInt(options.maxBytes, 10) : undefined,
        maxRedirects: options.maxRedirects ? parseInt(options.maxRedirects, 10) : undefined,
        clustering: options.clustering,
        clusterThreshold: options.clusterThreshold ? parseInt(options.clusterThreshold, 10) : undefined,
        minClusterSize: options.minClusterSize ? parseInt(options.minClusterSize, 10) : undefined,
        sitemap: options.sitemap,
        heading: options.heading,
        health: options.health,
        failOnCritical: options.failOnCritical,
        scoreBreakdown: options.scoreBreakdown,
        computePagerank: options.pagerank,
        computeHits: options.hits,
        orphans: options.orphans,
        orphanSeverity: options.orphanSeverity,
        includeSoftOrphans: options.includeSoftOrphans,
        minInbound: options.minInbound ? parseInt(options.minInbound, 10) : undefined,
        debug: options.logLevel === 'debug',
        plugins: registry.getPlugins(),
        context: {
          command: 'page',
          flags: options as Record<string, any>,
          logger: {
            info: (m: string) => context.emit({ type: 'info', message: m }),
            warn: (m: string) => context.emit({ type: 'warn', message: m, context: undefined }),
            error: (m: string) => context.emit({ type: 'error', message: m, error: null }),
            debug: (m: string) => context.emit({ type: 'debug', message: m })
          }
        }
      });

      // Render Output
      if (options.format === 'json') {
        const pages = result.pages.map(p => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { seoScore, thinScore, ...rest } = p as any;
          const active = result.active_modules;
          const hasFilters = active.seo || active.content || active.accessibility;

          if (hasFilters) {
            if (!active.seo) {
              delete rest.title;
              delete rest.metaDescription;
              delete rest.links;
              delete rest.structuredData;
            }
            if (!active.content) {
              delete rest.content;
            }
            if (!active.accessibility) {
              delete rest.images;
            }
            if (!active.seo && !active.content) {
              delete rest.h1;
            }
          }

          // Round ratios to 3 decimal places
          if (rest.content) {
            rest.content.textHtmlRatio = Number(rest.content.textHtmlRatio.toFixed(3));
          }
          if (rest.links) {
            rest.links.externalRatio = Number(rest.links.externalRatio.toFixed(3));
          }

          return {
            ...rest,
            health_score: Number(result.site_summary.site_score.toFixed(3))
          };
        });
        controller.renderResult(pages.length === 1 ? pages[0] : pages);
      } else {
        controller.renderResult(result, (res) => {
          const report = buildAnalyzeInsightReport(res);
          return renderAnalyzeInsightOutput(report, res);
        });
      }

    } catch (error) {
      context.emit({ type: 'error', message: 'Error', error });
      process.exit(1);
    }
  });

  return analyze;
};
