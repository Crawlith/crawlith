import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';

import { analyzeSite, EngineContext } from '@crawlith/core';
import { OutputController } from '../output/controller.js';
import { resolveCommandPlugins, registerPluginFlags } from '../plugins.js';
import { exportAnalysisResult } from '../output/export.js';
import {
  buildAnalyzeInsightReport,
  renderAnalyzeInsightOutput
} from './analyzeFormatter.js';

export const analyze = new Command('page')
  .description('Analyze a single URL for on-page SEO signals and content structure.')
  .argument('[url]', 'URL to analyze')
  .option('--live', 'Perform a live crawl before analysis')
  .option('--export [formats]', 'Export formats (comma-separated: json,markdown,csv,html)', false)
  .option('--format <type>', 'Output format (pretty, json)', 'pretty')
  .option('--log-level <level>', 'Log level (normal, verbose, debug)', 'normal')
  .option('--seo', 'Show only SEO module output')
  .option('--content', 'Show only content module output')
  .option('--accessibility', 'Show only accessibility module output')
  .option('--proxy <url>', 'proxy URL (for live crawl)')
  .option('--ua <string>', 'custom User-Agent (for live crawl)')
  .option('--max-redirects <number>', 'max redirect hops (for live crawl)', '2');

registerPluginFlags(analyze, 'page');

analyze.action(async (url: string, options: any) => {
  if (!url) {
    console.error(chalk.red('\n❌ Error: URL argument is required for analysis\n'));
    analyze.outputHelp();
    process.exit(0);
  }

  if (options.json) options.format = 'json';
  if (options.debug) options.logLevel = 'debug';
  if (options.verbose) options.logLevel = 'verbose';
  if (options.format === 'text') options.format = 'pretty';

  const controller = new OutputController({
    format: options.format as any,
    logLevel: options.logLevel as any
  });

  const context: EngineContext = {
    emit: (event) => controller.handle(event)
  };

  const activePlugins = resolveCommandPlugins('page', options as Record<string, boolean>);
  context.emit({ type: 'debug', message: `Active plugins: ${activePlugins.map((p) => p.name).join(', ')}` });

  try {
    if (!url) {
      console.error(chalk.red('\n❌ Error: URL argument is required for analysis\n'));
      analyze.outputHelp();
      process.exit(0);
    }

    // 4. Run Analysis
    const result = await analyzeSite(url as string, {
      live: options.live,
      seo: options.seo,
      content: options.content,
      accessibility: options.accessibility,
      rate: options.rate ? parseFloat(options.rate) : 2,
      proxyUrl: options.proxy,
      userAgent: options.ua,
      maxRedirects: options.maxRedirects ? parseInt(options.maxRedirects, 10) : 2,
      debug: options.logLevel === 'debug',
      clusterThreshold: options.clusterThreshold ? parseInt(options.clusterThreshold, 10) : 10,
      minClusterSize: options.minClusterSize ? parseInt(options.minClusterSize, 10) : 3
    }, context);

    // 5. Render Output
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

    // 7. Handle Exports
    if (options.export) {
      const formats = (typeof options.export === 'string'
        ? options.export.split(',')
        : (options.export === true ? ['json'] : [])
      ).map((s: string) => s.trim().toLowerCase()).filter(Boolean);

      if (formats.length > 0) {
        const urlObj = new URL(url as string);
        const domainFolder = urlObj.hostname.replace('www.', '');
        const outputDir = path.join(path.resolve(options.output || './crawlith-reports'), domainFolder);

        for (const fmt of formats) {
          if (['json', 'csv', 'markdown', 'html'].includes(fmt)) {
            try {
              const savedPath = await exportAnalysisResult(result, fmt as any, outputDir);
              context.emit({ type: 'info', message: `Export saved to ${savedPath}` });
            } catch (e: any) {
              context.emit({ type: 'error', message: `Failed to export ${fmt}`, error: e });
            }
          }
        }
      }
    }
  } catch (error) {
    context.emit({ type: 'error', message: 'Analysis failed', error });
    process.exit(1);
  }
});
