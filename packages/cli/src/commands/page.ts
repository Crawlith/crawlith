import { Command } from 'commander';
import chalk from 'chalk';

import { PageAnalysisUseCase, EngineContext, PluginManager } from '@crawlith/core';
import { OutputController } from '../output/controller.js';
import { resolveCommandPlugins, registerPluginFlags } from '../plugins.js';
import {
  buildAnalyzeInsightReport,
  renderAnalyzeInsightOutput
} from './analyzeFormatter.js';

export const analyze = new Command('page')
  .description('Analyze a single URL for on-page SEO signals and content structure.')
  .argument('[url]', 'URL to analyze')
  .option('--live', 'Perform a live crawl before analysis')
  .option('--log-level <level>', 'Log level (normal, verbose, debug)', 'normal')
  .option('--seo', 'Show only SEO module output')
  .option('--content', 'Show only content module output')
  .option('--accessibility', 'Show only accessibility module output');

registerPluginFlags(analyze, 'page');

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

  const activePlugins = resolveCommandPlugins('page', options as Record<string, boolean>);
  context.emit({ type: 'debug', message: `Active plugins: ${activePlugins.map((p) => p.name).join(', ')}` });

  const pm = new PluginManager(activePlugins, {
    debug: (message: string) => context.emit({ type: 'debug', message })
  });
  const pluginCtx: any = { command: 'page', flags: options as Record<string, boolean> };
  await pm.init(pluginCtx);
  if (pluginCtx.terminate) return;

  try {
    const useCase = new PageAnalysisUseCase(context);
    const result = await useCase.execute({
      url,
      live: options.live,
      seo: options.seo,
      content: options.content,
      accessibility: options.accessibility,
      debug: options.logLevel === 'debug',
      plugins: activePlugins,
      context: { command: 'page', flags: options as Record<string, boolean> }
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
