import {
  CrawlPlugin,
  calculateMetrics,
  loadGraphFromSnapshot,
  getDb,
  SnapshotRepository,
  parseExportFormats,
  runCrawlExports,
  runAnalysisExports
} from '@crawlith/core';
import path from 'node:path';
import chalk from 'chalk';

export const ExporterPlugin: CrawlPlugin = {
  name: 'ExporterPlugin',
  cli: {
    defaultFor: ['crawl', 'page', 'probe', 'export',],
    options: [
      { flags: "--export [formats]", description: "Export formats (comma-separated: json,markdown,csv,html,visualize)", defaultValue: false },
      { flags: "--format <value>", description: "Output format (pretty, json)", defaultValue: "pretty" },
      { flags: "--output <path>", description: "Output directory (for exports)", defaultValue: "./crawlith-reports" }
    ]
  },
  onAfterCrawl: async (ctx) => {
    const flags = ctx.flags || {};
    if (!flags.export || !ctx.snapshotId) return;

    const formats = parseExportFormats(flags.export);
    if (formats.length === 0) return;

    const snapshotId = ctx.snapshotId;
    const graph = loadGraphFromSnapshot(snapshotId);
    const db = getDb();
    const snapRepo = new SnapshotRepository(db);
    const snap = snapRepo.getSnapshot(snapshotId);
    if (!snap) return;

    const metrics = calculateMetrics(graph, 10);
    const graphData = graph.toJSON();

    const url = graphData.nodes.find(n => n.depth === 0)?.url || '';
    if (!url) return;

    const urlObj = new URL(url);
    const domainFolder = urlObj.hostname.replace('www.', '');
    const outputDir = path.join(path.resolve(String(flags.output || './crawlith-reports')), domainFolder);

    if (String(flags.format) !== 'json') {
      console.log(chalk.cyan(`\n📦 Exporter: Generating ${formats.join(', ')} exports...`));
    }

    await runCrawlExports(
      formats,
      outputDir,
      url,
      graphData,
      metrics,
      graph,
      ctx.report
    );

    if (String(flags.format) !== 'json') {
      console.log(chalk.gray(`📂 Exports saved to: ${chalk.blueBright(outputDir)}`));
    }
  },
  onAnalyzeDone: async (result: any, ctx: any) => {
    const flags = ctx.flags || {};
    if (!flags.export) return;

    const formats = parseExportFormats(flags.export);
    if (formats.length === 0) return;

    const url = result.url || result.pages?.[0]?.url || '';
    if (!url) return;

    const urlObj = new URL(url);
    const domainFolder = urlObj.hostname.replace('www.', '');
    const outputDir = path.join(path.resolve(String(flags.output || './crawlith-reports')), domainFolder);

    if (String(flags.format) !== 'json') {
      console.log(chalk.cyan(`\n📦 Exporter: Generating ${formats.join(', ')} exports...`));
    }

    await runAnalysisExports(
      formats,
      outputDir,
      result,
      ctx.command === 'page'
    );

    if (String(flags.format) !== 'json') {
      console.log(chalk.gray(`📂 Exports saved to: ${chalk.blueBright(outputDir)}`));
    }
  }
};
