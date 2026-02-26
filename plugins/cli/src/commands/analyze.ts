import { Command } from 'commander';
import path from 'node:path';
import { analyzeSite, EngineContext } from '@crawlith/core';
import { OutputController } from '../output/controller.js';
import { exportAnalysisResult } from '../output/export.js';
import {
  buildAnalyzeInsightReport,
  hasAnalyzeCriticalIssues,
  renderAnalyzeInsightOutput
} from './analyzeFormatter.js';

export const analyze = new Command('analyze')
  .description('Analyze SEO and content quality from crawl data')
  .argument('<url>', 'URL to analyze')
  .option('--live', 'Perform a live crawl before analysis')
  .option('--export [formats]', 'Export formats (comma-separated: json,markdown,csv,html)', false)
  .option('--format <type>', 'Output format (pretty, json)', 'pretty')
  .option('--log-level <level>', 'Log level (normal, verbose, debug)', 'normal')
  // Backward compatibility flags
  .option('--json', 'Use JSON output (deprecated, use --format=json)')
  .option('--debug', 'Use debug logging (deprecated, use --log-level=debug)')
  .option('--verbose', 'Use verbose logging (deprecated, use --log-level=verbose)')

  .option('--seo', 'Show only SEO module output')
  .option('--content', 'Show only content module output')
  .option('--accessibility', 'Show only accessibility module output')
  .option('--fail-on-critical', 'exit code 1 if critical issues exist')
  .option('--rate <number>', 'requests per second (for live crawl)', '2')
  .option('--proxy <url>', 'proxy URL (for live crawl)')
  .option('--ua <string>', 'custom User-Agent (for live crawl)')
  .option('--max-redirects <number>', 'max redirect hops (for live crawl)', '2')
  .option('--cluster-threshold <number>', 'Hamming distance for content clusters', '10')
  .option('--min-cluster-size <number>', 'minimum pages per cluster', '3')
  .option('-o, --output <path>', 'Output directory for reports', './crawlith-reports')
  .action(async (url, options) => {
    // 1. Normalize Options
    if (options.json) options.format = 'json';
    if (options.debug) options.logLevel = 'debug';
    if (options.verbose) options.logLevel = 'verbose';
    if (options.format === 'text') options.format = 'pretty'; // Compat

    // 2. Initialize Output Controller
    const controller = new OutputController({
      format: options.format as any,
      logLevel: options.logLevel as any
    });

    // 3. Create Engine Context
    const context: EngineContext = {
      emit: (event) => controller.handle(event)
    };

    try {
      // 4. Run Analysis
      const result = await analyzeSite(url, {
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
      controller.renderResult(result, (res) => {
        const report = buildAnalyzeInsightReport(res);
        return renderAnalyzeInsightOutput(report);
      });

      // 6. Check Critical Issues
      if (options.failOnCritical) {
        const report = buildAnalyzeInsightReport(result);
        if (hasAnalyzeCriticalIssues(report)) {
          process.exit(1);
        }
      }

      // 7. Handle Exports
      if (options.export) {
        const formats = (typeof options.export === 'string'
          ? options.export.split(',')
          : (options.export === true ? ['json'] : [])
        ).map(s => s.trim().toLowerCase()).filter(Boolean);

        if (formats.length > 0) {
          const urlObj = new URL(url);
          const domainFolder = urlObj.hostname.replace('www.', '');
          const outputDir = path.join(path.resolve(options.output), domainFolder);

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
