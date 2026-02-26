import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs/promises';
import chalk from 'chalk';
import {
  crawl,
  calculateMetrics,
  Graph,
  compareGraphs,
  annotateOrphans,
  detectDuplicates,
  detectContentClusters,
  runPostCrawlMetrics,
  loadGraphFromSnapshot,
  LockManager,
  EngineContext
} from '@crawlith/core';
import { buildSitegraphInsightReport, hasCriticalIssues, renderInsightOutput, renderScoreBreakdown } from './sitegraphFormatter.js';
import { parseExportFormats, runSitegraphExports } from '../utils/exportRunner.js';
import { OutputController } from '../output/controller.js';

export const sitegraph = new Command('crawl')
  .description('Crawl an entire website and build its internal link graph, metrics, and SEO structure.')
  .argument('[url]', 'URL to crawl')
  .option('-l, --limit <number>', 'max pages', '500')
  .option('-d, --depth <number>', 'max click depth', '5')
  .option('-o, --output <path>', 'output directory (for exports)', './crawlith-reports')
  .option('-c, --concurrency <number>', 'max concurrent requests', '2')
  .option('--no-query', 'strip query params')
  .option('--ignore-robots', 'ignore robots.txt')
  .option('--incremental', 'incremental crawl using previous snapshot')
  .option('--sitemap [url]', 'sitemap URL (defaults to /sitemap.xml if not specified)')
  .option('--compare <files...>', 'internal: compare two graph JSON files')
  .option('--orphans', 'enable orphan detection')
  .option('--orphan-severity', 'enable orphan severity scoring')
  .option('--include-soft-orphans', 'include soft orphan detection')
  .option('--min-inbound <number>', 'near-orphan threshold override', '2')

  // Unified Output Flags
  .option('--format <type>', 'Output format (pretty, json)', 'pretty')
  .option('--log-level <level>', 'Log level (normal, verbose, debug)', 'normal')

  .option('--export [formats]', 'Export formats (comma-separated: json,markdown,csv,html,visualize)', false)

  .option('--detect-soft404', 'Detect soft 404 pages')
  .option('--detect-traps', 'Detect and cluster crawl traps')
  .option('--no-collapse', 'Do not collapse duplicate clusters before PageRank')
  .option('--fail-on-critical', 'exit code 1 if critical issues exist')
  .option('--score-breakdown', 'print health score component weights')
  .option('--rate <number>', 'requests per second per host', '2')
  .option('--max-bytes <number>', 'max response size in bytes', '2000000')
  .option('--max-redirects <number>', 'max redirect hops', '2')
  .option('--allow <domains>', 'whitelist of domains (comma separated)')
  .option('--deny <domains>', 'blacklist of domains (comma separated)')
  .option('--include-subdomains', 'include subdomains in crawl')
  .option('--proxy <url>', 'proxy URL (e.g. http://user:pass@host:port)')
  .option('--ua <string>', 'custom User-Agent string')
  .option('--cluster-threshold <number>', 'Hamming distance for content clusters', '10')
  .option('--compute-hits', 'compute Hub and Authority scores (HITS)')
  .option('--min-cluster-size <number>', 'minimum pages per cluster', '3')
  .option('--force', 'force run (override existing lock)')
  .action(async (url: string, options: any) => {

    if (!url) {
      console.error(chalk.red('\n❌ Error: URL argument is required for crawling\n'));
      sitegraph.outputHelp();
      process.exit(0);
    }

    if (options.json) options.format = 'json';
    if (options.debug) options.logLevel = 'debug';
    if (options.verbose) options.logLevel = 'verbose';
    if (options.format === 'text') options.format = 'pretty';

    // 2. Initialize Controller
    const controller = new OutputController({
      format: options.format,
      logLevel: options.logLevel
    });
    const context: EngineContext = {
      emit: (e) => controller.handle(e)
    };

    try {
      // Handle compare mode first
      if (options.compare) {
        if (options.compare.length !== 2) {
          controller.handle({ type: 'error', message: 'Error: --compare requires exactly two file paths (old.json new.json)' });
          process.exit(1);
        }

        const [oldFile, newFile] = options.compare;
        if (options.format !== 'json') {
          console.log(chalk.cyan(`\n🔍 Comparing Graphs`));
          console.log(`${chalk.gray('Old:')} ${oldFile}`);
          console.log(`${chalk.gray('New:')} ${newFile}\n`);
        }

        const oldJson = JSON.parse(await fs.readFile(oldFile, 'utf-8'));
        const newJson = JSON.parse(await fs.readFile(newFile, 'utf-8'));

        const oldGraph = Graph.fromJSON(oldJson);
        const newGraph = Graph.fromJSON(newJson);

        const diffResult = compareGraphs(oldGraph, newGraph);

        if (options.format !== 'json') {
          console.log(chalk.bold('📈 Comparison Results:'));
          console.log(`- Added URLs:   ${chalk.green(diffResult.addedUrls.length)}`);
          console.log(`- Removed URLs: ${chalk.red(diffResult.removedUrls.length)}`);
          console.log(`- Status Changes: ${chalk.yellow(diffResult.changedStatus.length)}`);

          console.log(chalk.bold('\n📉 Metric Deltas:'));
          Object.entries(diffResult.metricDeltas).forEach(([metric, delta]) => {
            const deltaStr = delta > 0 ? chalk.green(`+${delta.toFixed(3)}`) : (delta < 0 ? chalk.red(delta.toFixed(3)) : chalk.gray('0'));
            console.log(`  ${metric.padEnd(20)}: ${deltaStr}`);
          });

          console.log('\n' + chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n');
        } else {
          console.log(JSON.stringify(diffResult, null, 2));
        }
        return;
      }

      if (!url) {
        if (!url) {
          controller.handle({ type: 'error', message: 'Error: URL argument is required for crawling' });
          process.exit(1);
        }
      }

      // Acquire process lock
      await LockManager.acquireLock('sitegraph', url, options, context, options.force);

      if (options.format !== 'json') {
        console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith Site Crawler`));
        console.log(`${chalk.gray('Target:')} ${chalk.blueBright(url)}`);
        console.log(`${chalk.gray('Limits:')} Pages: ${options.limit} | Depth: ${options.depth}\n`);
      }

      const limit = parseInt(options.limit, 10);
      const depth = parseInt(options.depth, 10);
      const minInbound = parseInt(options.minInbound, 10);

      const maxRedirects = parseInt(options.maxRedirects, 10);
      const allowedDomains = options.allow ? options.allow.split(',').map((d: string) => d.trim()) : [];
      const deniedDomains = options.deny ? options.deny.split(',').map((d: string) => d.trim()) : [];
      const proxyUrl = options.proxy;

      if (proxyUrl) {
        try {
          new URL(proxyUrl);
        } catch {
          controller.handle({ type: 'error', message: `Error: Invalid proxy URL: ${proxyUrl}` });
          process.exit(1);
        }
      }

      if (options.orphanSeverity && !options.orphans) {
        throw new Error('--orphan-severity requires --orphans');
      }

      const stripQuery = !options.query;

      // Handle sitemap option
      let sitemap = options.sitemap;
      if (sitemap === true) {
        sitemap = 'true'; // trigger auto-discovery in crawl function
      }

      const snapshotId = await crawl(url, {
        limit,
        depth,
        stripQuery,
        ignoreRobots: options.ignoreRobots,
        sitemap: sitemap as string | undefined,
        debug: options.logLevel === 'debug',
        detectSoft404: options.detectSoft404,
        detectTraps: options.detectTraps,
        rate: parseFloat(options.rate),
        maxBytes: parseInt(options.maxBytes, 10),
        allowedDomains,
        deniedDomains,
        includeSubdomains: !!options.includeSubdomains,
        proxyUrl,
        maxRedirects,
        userAgent: options.ua,
        concurrency: options.concurrency ? parseInt(options.concurrency, 10) : 2
      }, context);
      // Load graph from DB (single source of truth)
      const graph = loadGraphFromSnapshot(snapshotId);
      const _nodes = graph.getNodes();
      // if (nodes.length === 0) {
      //   console.log(chalk.red('\n❌ No pages were crawled.'));
      //   console.log(chalk.gray(`The target URL ${chalk.white(url)} could not be reached or is blocked by robots.txt.`));
      //   console.log(chalk.gray('Try running with ') + chalk.white('--ignore-robots') + chalk.gray(' or ') + chalk.white('--debug') + chalk.gray(' for more details.\n'));
      //   process.exit(1);
      // }

      if (options.format !== 'json') process.stdout.write(chalk.gray('📊 Calculating metrics and saving to database... '));
      runPostCrawlMetrics(snapshotId, depth, context);
      if (options.format !== 'json') process.stdout.write(chalk.green('Done\n'));


      // if (nodes.length === 0) {
      //   console.log(chalk.red('\n❌ No pages were crawled.'));
      //   console.log(chalk.gray(`The target URL ${chalk.white(url)} could not be reached or is blocked by robots.txt.`));
      //   console.log(chalk.gray('Try running with ') + chalk.white('--ignore-robots') + chalk.gray(' or ') + chalk.white('--debug') + chalk.gray(' for more details.\n'));
      //   process.exit(1);
      // }

      if (options.format !== 'json') {
        console.log(chalk.green(`\n✅ Crawl complete.`));
        process.stdout.write(chalk.gray('🔍 Detecting duplicates... '));
      }

      detectDuplicates(graph, { collapse: !options.noCollapse });
      if (options.format !== 'json') process.stdout.write(chalk.green('Done\n'));

      if (options.format !== 'json') process.stdout.write(chalk.gray('🧩 Clustering content... '));
      detectContentClusters(graph,
        options.clusterThreshold ? parseInt(options.clusterThreshold, 10) : 10,
        options.minClusterSize ? parseInt(options.minClusterSize, 10) : 3
      );
      if (options.format !== 'json') process.stdout.write(chalk.green('Done\n'));

      if (options.format !== 'json') process.stdout.write(chalk.gray('📊 Calculating final report metrics... '));
      const metrics = calculateMetrics(graph, depth);
      if (options.format !== 'json') process.stdout.write(chalk.green('Done\n'));

      const graphData = graph.toJSON();
      const orphanAnnotatedNodes = annotateOrphans(graphData.nodes, graphData.edges, {
        enabled: !!options.orphans,
        severityEnabled: !!options.orphanSeverity,
        includeSoftOrphans: !!options.includeSoftOrphans,
        minInbound: Number.isNaN(minInbound) ? 2 : minInbound,
        rootUrl: graphData.nodes.find((node) => node.depth === 0)?.url
      });
      graphData.nodes = orphanAnnotatedNodes;

      // === Optional file exports ===
      const exportFormats = parseExportFormats(options.export);

      if (exportFormats.length > 0) {
        const urlObj = new URL(url as string);
        const domainFolder = urlObj.hostname.replace('www.', '');
        const outputDir = path.join(path.resolve(options.output), domainFolder);

        await runSitegraphExports(
          exportFormats,
          outputDir,
          url,
          graphData,
          metrics,
          graph
        );
      }

      // === Console output (always from DB) ===
      const insightReport = buildSitegraphInsightReport(graph, metrics);
      if (options.format === 'json') {
        process.stdout.write(JSON.stringify(insightReport, null, 2));
      } else {
        process.stdout.write(renderInsightOutput(insightReport, snapshotId));
      }

      if (options.scoreBreakdown && options.format !== 'json') {
        console.log(renderScoreBreakdown(insightReport.health));
      }

      if (options.verbose && options.format !== 'json') {
        console.log(chalk.bold('\nVerbose Crawl Stats'));
        console.log(`Fetched: ${graph.sessionStats.pagesFetched}`);
        console.log(`Cached: ${graph.sessionStats.pagesCached}`);
        console.log(`Skipped: ${graph.sessionStats.pagesSkipped}`);
        console.log(`Total Found: ${graph.sessionStats.totalFound}`);
      }

      if (options.format !== 'json') {
        console.log("\n💾 run `crawlith ui` to view the full report");
        if (exportFormats.length > 0) {
          const urlObj = new URL(url);
          const domainFolder = urlObj.hostname.replace('www.', '');
          const outputDir = path.join(path.resolve(options.output), domainFolder);
          console.log(`📂 Exports saved to: ${chalk.blueBright(outputDir)}`);
        }
        console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
      }
      if (options.failOnCritical && hasCriticalIssues(insightReport)) {
        process.exit(1);
      }

    } catch (error) {
      controller.handle({ type: 'error', message: 'Error', error });
      process.exit(1);
    }
  });
