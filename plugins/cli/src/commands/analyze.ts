import { CommandModule } from 'yargs';
import path from 'node:path';
import { analyzeSite, EngineContext } from '@crawlith/core';
import { OutputController } from '../output/controller.js';
import { exportAnalysisResult } from '../output/export.js';
import {
  buildAnalyzeInsightReport,
  hasAnalyzeCriticalIssues,
  renderAnalyzeInsightOutput
} from './analyzeFormatter.js';
import { withOutputOptions, withExportOption } from './shared.js';

export const analyzeCommand: CommandModule = {
  command: 'analyze <url>',
  describe: 'Analyze SEO and content quality from crawl data',
  builder: (y) => {
    return withOutputOptions(withExportOption(y))
      .positional('url', {
        type: 'string',
        describe: 'URL to analyze'
      })
      .option('live', {
        type: 'boolean',
        describe: 'Perform a live crawl before analysis'
      })
      .option('seo', {
        type: 'boolean',
        describe: 'Show only SEO module output'
      })
      .option('content', {
        type: 'boolean',
        describe: 'Show only content module output'
      })
      .option('accessibility', {
        type: 'boolean',
        describe: 'Show only accessibility module output'
      })
      .option('fail-on-critical', {
        type: 'boolean',
        describe: 'exit code 1 if critical issues exist'
      })
      .option('rate', {
        type: 'number',
        default: 2,
        describe: 'requests per second (for live crawl)'
      })
      .option('proxy', {
        type: 'string',
        describe: 'proxy URL (for live crawl)'
      })
      .option('ua', {
        type: 'string',
        describe: 'custom User-Agent (for live crawl)'
      })
      .option('max-redirects', {
        type: 'number',
        default: 2,
        describe: 'max redirect hops (for live crawl)'
      })
      .option('cluster-threshold', {
        type: 'number',
        default: 10,
        describe: 'Hamming distance for content clusters'
      })
      .option('min-cluster-size', {
        type: 'number',
        default: 3,
        describe: 'minimum pages per cluster'
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        default: './crawlith-reports',
        describe: 'Output directory for reports'
      });
  },
  handler: async (argv: any) => {
    // 2. Initialize Output Controller
    const controller = new OutputController({
      format: argv.format as any,
      logLevel: argv['log-level'] as any
    });

    // 3. Create Engine Context
    const context: EngineContext = {
      emit: (event) => controller.handle(event)
    };

    try {
      const url = argv.url;

      // 4. Run Analysis
      const result = await analyzeSite(url, {
        live: argv.live,
        seo: argv.seo,
        content: argv.content,
        accessibility: argv.accessibility,
        rate: argv.rate,
        proxyUrl: argv.proxy,
        userAgent: argv.ua,
        maxRedirects: argv['max-redirects'],
        debug: argv['log-level'] === 'debug',
        clusterThreshold: argv['cluster-threshold'],
        minClusterSize: argv['min-cluster-size']
      }, context);

      // 5. Render Output
      controller.renderResult(result, (res) => {
        const report = buildAnalyzeInsightReport(res);
        return renderAnalyzeInsightOutput(report);
      });

      // 6. Check Critical Issues
      if (argv['fail-on-critical']) {
        const report = buildAnalyzeInsightReport(result);
        if (hasAnalyzeCriticalIssues(report)) {
          process.exit(1);
        }
      }

      // 7. Handle Exports
      if (argv.export) {
        const formats = (typeof argv.export === 'string'
          ? argv.export.split(',')
          : (argv.export === true ? ['json'] : [])
        ).map((s: string) => s.trim().toLowerCase()).filter(Boolean);

        if (formats.length > 0) {
          const urlObj = new URL(url);
          const domainFolder = urlObj.hostname.replace('www.', '');
          const outputDir = path.join(path.resolve(argv.output), domainFolder);

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
  }
};
