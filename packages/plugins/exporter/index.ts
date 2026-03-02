import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');

import {
  CrawlithPlugin,
  PluginContext,
  parseExportFormats,
  calculateMetrics,
  runCrawlExports,
  runAnalysisExports
} from '@crawlith/core';
import path from 'node:path';
import chalk from 'chalk';
import { Command } from '@crawlith/core';

/**
 * Exporter Plugin
 * Crawlith plugin for exporter
 */
export const ExporterPlugin: CrawlithPlugin = {
  name: 'exporter',
  version: pkg.version,
  description: pkg.description,

  register: (cli: Command) => {
    if (['crawl', 'page', 'probe', 'export'].includes(cli.name())) {
      cli
        .option("--export [formats]", "Export formats (comma-separated: json,markdown,csv,html,visualize)", false)
        .option("--format <value>", "Output format (pretty, json)", "pretty")
        .option("--output <path>", "Output directory (for exports)", "./crawlith-reports");
    }
  },

  hooks: {
    onReport: async (ctx: PluginContext, result: any) => {
      const flags = ctx.flags || {};
      if (!flags.export) return;

      const formats = parseExportFormats(flags.export);
      if (formats.length === 0) return;

      // Handle both crawl result (graph/snapshotId) and analysis result
      const isCrawl = !!result.snapshotId && !!result.graph;

      const url = isCrawl
        ? result.graph.toJSON().nodes.find((n: any) => n.depth === 0)?.url || ''
        : (result.url || result.pages?.[0]?.url || '');

      if (!url) return;

      const urlObj = new URL(url);
      const domainFolder = urlObj.hostname.replace('www.', '');
      const outputDir = path.join(path.resolve(String(flags.output || './crawlith-reports')), domainFolder);

      if (String(flags.format) !== 'json') {
        console.log(chalk.cyan(`\n📦 Exporter: Generating ${formats.join(', ')} exports...`));
      }

      if (isCrawl) {
        const { snapshotId: _snapshotId, graph } = result;
        const metrics = calculateMetrics(graph, 10);
        await runCrawlExports(
          formats,
          outputDir,
          url,
          graph.toJSON(),
          metrics,
          graph
        );
      } else {
        await runAnalysisExports(
          formats,
          outputDir,
          result,
          ctx.command === 'page'
        );
      }

      if (String(flags.format) !== 'json') {
        console.log(chalk.gray(`📂 Exports saved to: ${chalk.blueBright(outputDir)}`));
      }
    }
  }
};

export default ExporterPlugin;
