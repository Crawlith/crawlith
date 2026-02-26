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
  LockManager
} from '@crawlith/core';
import { buildSitegraphInsightReport, hasCriticalIssues, renderInsightOutput, renderScoreBreakdown } from './sitegraphFormatter.js';
import { parseExportFormats, runSitegraphExports } from '../utils/exportRunner.js';

export const sitegraph = new Command('sitegraph')
  .description('Crawl site and build internal link graph')
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
  .option('--debug', 'output each crawl url details')
  .option('--export [formats]', 'Export formats (comma-separated: json,markdown,csv,html,visualize)', false)
  .option('--format <type>', 'Output format to terminal (text, json)', 'text')
  .option('--detect-soft404', 'Detect soft 404 pages')
  .option('--detect-traps', 'Detect and cluster crawl traps')
  .option('--no-collapse', 'Do not collapse duplicate clusters before PageRank')
  .option('--verbose', 'detailed crawl stats')
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
  .action(async (url, options) => {
    try {
      // Handle compare mode first
      if (options.compare) {
        if (options.compare.length !== 2) {
          console.error(chalk.red('❌ Error: --compare requires exactly two file paths (old.json new.json)'));
          process.exit(1);
        }

        const [oldFile, newFile] = options.compare;
        console.log(chalk.cyan(`\n🔍 Comparing Graphs`));
        console.log(`${chalk.gray('Old:')} ${oldFile}`);
        console.log(`${chalk.gray('New:')} ${newFile}\n`);

        const oldJson = JSON.parse(await fs.readFile(oldFile, 'utf-8'));
        const newJson = JSON.parse(await fs.readFile(newFile, 'utf-8'));

        const oldGraph = Graph.fromJSON(oldJson);
        const newGraph = Graph.fromJSON(newJson);

        const diffResult = compareGraphs(oldGraph, newGraph);

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
        return;
      }

      if (!url) {
        console.error(chalk.red('\n❌ Error: URL argument is required for crawling\n'));
        sitegraph.outputHelp();
        process.exit(0);
      }

      // Acquire process lock
      await LockManager.acquireLock('sitegraph', url, options, options.force);

      console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith Site Crawler`));
      console.log(`${chalk.gray('Target:')} ${chalk.blueBright(url)}`);
      console.log(`${chalk.gray('Limits:')} Pages: ${options.limit} | Depth: ${options.depth}\n`);

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
          console.error(chalk.red(`❌ Error: Invalid proxy URL: ${proxyUrl}`));
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
        debug: options.debug,
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
      });
      process.stdout.write(chalk.gray('📊 Calculating metrics and saving to database... '));
      runPostCrawlMetrics(snapshotId, depth);
      process.stdout.write(chalk.green('Done\n'));

      // Load graph from DB (single source of truth)
      const graph = loadGraphFromSnapshot(snapshotId);
      const nodes = graph.getNodes();
      console.log(chalk.green(`\n✅ Crawl complete. Found ${chalk.bold(nodes.length)} pages.`));
      console.log(chalk.gray(`   Snapshot ID: ${snapshotId}`));

      process.stdout.write(chalk.gray('🔍 Detecting duplicates... '));
      detectDuplicates(graph, { collapse: !options.noCollapse });
      process.stdout.write(chalk.green('Done\n'));

      process.stdout.write(chalk.gray('🧩 Clustering content... '));
      detectContentClusters(graph,
        options.clusterThreshold ? parseInt(options.clusterThreshold, 10) : 10,
        options.minClusterSize ? parseInt(options.minClusterSize, 10) : 3
      );
      process.stdout.write(chalk.green('Done\n'));

      process.stdout.write(chalk.gray('📊 Calculating final report metrics... '));
      const metrics = calculateMetrics(graph, depth);
      process.stdout.write(chalk.green('Done\n'));

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
        const urlObj = new URL(url);
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
        console.log(JSON.stringify(insightReport, null, 2));
      } else {
        process.stdout.write(renderInsightOutput(insightReport));
      }

      if (options.scoreBreakdown) {
        console.log(renderScoreBreakdown(insightReport.health));
      }

      if (options.verbose) {
        console.log(chalk.bold('\nVerbose Crawl Stats'));
        console.log(`Fetched: ${graph.sessionStats.pagesFetched}`);
        console.log(`Cached: ${graph.sessionStats.pagesCached}`);
        console.log(`Skipped: ${graph.sessionStats.pagesSkipped}`);
        console.log(`Total Found: ${graph.sessionStats.totalFound}`);
      }

      console.log(`\n💾 Data stored in database (snapshot #${snapshotId})`);
      if (exportFormats.length > 0) {
        const urlObj = new URL(url);
        const domainFolder = urlObj.hostname.replace('www.', '');
        const outputDir = path.join(path.resolve(options.output), domainFolder);
        console.log(`📂 Exports saved to: ${chalk.blueBright(outputDir)}`);
      }
      console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

      if (options.failOnCritical && hasCriticalIssues(insightReport)) {
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error);
      process.exit(1);
    }
  });
