import { Command } from 'commander';
import path from 'node:path';
import { analyzeSite } from '@crawlith/core';
import {
  buildAnalyzeInsightReport,
  hasAnalyzeCriticalIssues,
  renderAnalyzeInsightOutput
} from './analyzeFormatter.js';
import { parseExportFormats, runAnalysisExports } from '../utils/exportRunner.js';

export const analyze = new Command('analyze')
  .description('Analyze SEO and content quality from crawl data')
  .argument('<url>', 'URL to analyze')
  .option('--from-crawl <path>', 'Load an existing crawl JSON file')
  .option('--live', 'Perform a live crawl before analysis')
  .option('--export [formats]', 'Export formats (comma-separated: json,markdown,csv,html)', false)
  .option('--format <type>', 'Output format to terminal (text, json)', 'text')
  .option('--seo', 'Show only SEO module output')
  .option('--content', 'Show only content module output')
  .option('--accessibility', 'Show only accessibility module output')
  .option('--fail-on-critical', 'exit code 1 if critical issues exist')
  .option('--rate <number>', 'requests per second (for live crawl)', '2')
  .option('--proxy <url>', 'proxy URL (for live crawl)')
  .option('--ua <string>', 'custom User-Agent (for live crawl)')
  .option('--max-redirects <number>', 'max redirect hops (for live crawl)', '2')
  .option('--debug', 'output live crawl details')
  .option('--cluster-threshold <number>', 'Hamming distance for content clusters', '10')
  .option('--min-cluster-size <number>', 'minimum pages per cluster', '3')
  .option('-o, --output <path>', 'Output directory for reports', './crawlith-reports')
  .action(async (url, options) => {
    try {
      const result = await analyzeSite(url, {
        fromCrawl: options.fromCrawl,
        live: options.live,
        html: options.html,
        seo: options.seo,
        content: options.content,
        accessibility: options.accessibility,
        rate: options.rate ? parseFloat(options.rate) : 2,
        proxyUrl: options.proxy,
        userAgent: options.ua,
        maxRedirects: options.maxRedirects ? parseInt(options.maxRedirects, 10) : 2,
        debug: options.debug,
        clusterThreshold: options.clusterThreshold ? parseInt(options.clusterThreshold, 10) : 10,
        minClusterSize: options.minClusterSize ? parseInt(options.minClusterSize, 10) : 3
      });

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const report = buildAnalyzeInsightReport(result);
        process.stdout.write(renderAnalyzeInsightOutput(report));
        if (options.failOnCritical && hasAnalyzeCriticalIssues(report)) {
          process.exit(1);
        }
      }

      const exportFormats = parseExportFormats(options.export);

      if (exportFormats.length > 0) {
        const urlObj = new URL(url);
        const domainFolder = urlObj.hostname.replace('www.', '');
        const outputDir = path.join(path.resolve(options.output), domainFolder);

        await runAnalysisExports(
          exportFormats,
          outputDir,
          result,
          options.live
        );
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });
