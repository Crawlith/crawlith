import { CommandModule } from 'yargs';
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
import { withOutputOptions, withExportOption } from './shared.js';

export const sitegraphCommand: CommandModule = {
  command: 'sitegraph [url]',
  describe: 'Crawl a website and generate a link graph',
  builder: (y) => {
    return withOutputOptions(withExportOption(y))
      .positional('url', {
        type: 'string',
        describe: 'URL to crawl'
      })
      .option('limit', {
        alias: 'l',
        type: 'number',
        default: 500,
        describe: 'max pages'
      })
      .option('depth', {
        alias: 'd',
        type: 'number',
        default: 5,
        describe: 'max click depth'
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        default: './crawlith-reports',
        describe: 'output directory (for exports)'
      })
      .option('concurrency', {
        alias: 'c',
        type: 'number',
        default: 2,
        describe: 'max concurrent requests'
      })
      .option('query', {
        type: 'boolean',
        default: true,
        describe: 'keep query params (use --no-query to strip)'
      })
      .option('ignore-robots', {
        type: 'boolean',
        describe: 'ignore robots.txt'
      })
      .option('incremental', {
        type: 'boolean',
        describe: 'incremental crawl using previous snapshot'
      })
      .option('sitemap', {
        describe: 'sitemap URL (defaults to /sitemap.xml if not specified)'
        // type not specified to allow boolean or string
      })
      .option('compare', {
        type: 'string',
        array: true,
        describe: 'internal: compare two graph JSON files'
      })
      .option('orphans', {
        type: 'boolean',
        describe: 'enable orphan detection'
      })
      .option('orphan-severity', {
        type: 'boolean',
        describe: 'enable orphan severity scoring'
      })
      .option('include-soft-orphans', {
        type: 'boolean',
        describe: 'include soft orphan detection'
      })
      .option('min-inbound', {
        type: 'number',
        default: 2,
        describe: 'near-orphan threshold override'
      })
      .option('detect-soft404', {
        type: 'boolean',
        describe: 'Detect soft 404 pages'
      })
      .option('detect-traps', {
        type: 'boolean',
        describe: 'Detect and cluster crawl traps'
      })
      .option('collapse', {
        type: 'boolean',
        default: true,
        describe: 'collapse duplicate clusters before PageRank (use --no-collapse to disable)'
      })
      .option('fail-on-critical', {
        type: 'boolean',
        describe: 'exit code 1 if critical issues exist'
      })
      .option('score-breakdown', {
        type: 'boolean',
        describe: 'print health score component weights'
      })
      .option('rate', {
        type: 'number',
        default: 2,
        describe: 'requests per second per host'
      })
      .option('max-bytes', {
        type: 'number',
        default: 2000000,
        describe: 'max response size in bytes'
      })
      .option('max-redirects', {
        type: 'number',
        default: 2,
        describe: 'max redirect hops'
      })
      .option('allow', {
        type: 'string',
        describe: 'whitelist of domains (comma separated)'
      })
      .option('deny', {
        type: 'string',
        describe: 'blacklist of domains (comma separated)'
      })
      .option('include-subdomains', {
        type: 'boolean',
        describe: 'include subdomains in crawl'
      })
      .option('proxy', {
        type: 'string',
        describe: 'proxy URL (e.g. http://user:pass@host:port)'
      })
      .option('ua', {
        type: 'string',
        describe: 'custom User-Agent string'
      })
      .option('cluster-threshold', {
        type: 'number',
        default: 10,
        describe: 'Hamming distance for content clusters'
      })
      .option('compute-hits', {
        type: 'boolean',
        describe: 'compute Hub and Authority scores (HITS)'
      })
      .option('min-cluster-size', {
        type: 'number',
        default: 3,
        describe: 'minimum pages per cluster'
      })
      .option('force', {
        type: 'boolean',
        describe: 'force run (override existing lock)'
      });
  },
  handler: async (argv: any) => {
    // 2. Initialize Controller
    const controller = new OutputController({
        format: argv.format,
        logLevel: argv['log-level']
    });
    const context: EngineContext = {
        emit: (e) => controller.handle(e)
    };

    try {
      // Handle compare mode first
      if (argv.compare) {
        if (argv.compare.length !== 2) {
          controller.handle({ type: 'error', message: 'Error: --compare requires exactly two file paths (old.json new.json)' });
          process.exit(1);
        }

        const [oldFile, newFile] = argv.compare;
        if (argv.format !== 'json') {
            console.log(chalk.cyan(`\n🔍 Comparing Graphs`));
            console.log(`${chalk.gray('Old:')} ${oldFile}`);
            console.log(`${chalk.gray('New:')} ${newFile}\n`);
        }

        const oldJson = JSON.parse(await fs.readFile(oldFile, 'utf-8'));
        const newJson = JSON.parse(await fs.readFile(newFile, 'utf-8'));

        const oldGraph = Graph.fromJSON(oldJson);
        const newGraph = Graph.fromJSON(newJson);

        const diffResult = compareGraphs(oldGraph, newGraph);

        if (argv.format !== 'json') {
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

      const url = argv.url;

      if (!url) {
        controller.handle({ type: 'error', message: 'Error: URL argument is required for crawling' });
        process.exit(1);
      }

      // Acquire process lock
      await LockManager.acquireLock('sitegraph', url, argv, context, argv.force);

      if (argv.format !== 'json') {
          console.log(chalk.bold.cyan(`\n🚀 Starting Crawlith Site Crawler`));
          console.log(`${chalk.gray('Target:')} ${chalk.blueBright(url)}`);
          console.log(`${chalk.gray('Limits:')} Pages: ${argv.limit} | Depth: ${argv.depth}\n`);
      }

      const limit = argv.limit;
      const depth = argv.depth;
      const minInbound = argv['min-inbound'];

      const maxRedirects = argv['max-redirects'];
      const allowedDomains = argv.allow ? argv.allow.split(',').map((d: string) => d.trim()) : [];
      const deniedDomains = argv.deny ? argv.deny.split(',').map((d: string) => d.trim()) : [];
      const proxyUrl = argv.proxy;

      if (proxyUrl) {
        try {
          new URL(proxyUrl);
        } catch {
          controller.handle({ type: 'error', message: `Error: Invalid proxy URL: ${proxyUrl}` });
          process.exit(1);
        }
      }

      if (argv['orphan-severity'] && !argv.orphans) {
        throw new Error('--orphan-severity requires --orphans');
      }

      const stripQuery = !argv.query;

      // Handle sitemap option
      let sitemap = argv.sitemap;
      if (sitemap === true) {
        sitemap = 'true'; // trigger auto-discovery in crawl function
      }

      const snapshotId = await crawl(url, {
        limit,
        depth,
        stripQuery,
        ignoreRobots: argv['ignore-robots'],
        sitemap: sitemap as string | undefined,
        debug: argv['log-level'] === 'debug',
        detectSoft404: argv['detect-soft404'],
        detectTraps: argv['detect-traps'],
        rate: argv.rate,
        maxBytes: argv['max-bytes'],
        allowedDomains,
        deniedDomains,
        includeSubdomains: !!argv['include-subdomains'],
        proxyUrl,
        maxRedirects,
        userAgent: argv.ua,
        concurrency: argv.concurrency
      }, context);

      if (argv.format !== 'json') process.stdout.write(chalk.gray('📊 Calculating metrics and saving to database... '));
      runPostCrawlMetrics(snapshotId, depth, context);
      if (argv.format !== 'json') process.stdout.write(chalk.green('Done\n'));

      // Load graph from DB (single source of truth)
      const graph = loadGraphFromSnapshot(snapshotId);
      const nodes = graph.getNodes();

      if (argv.format !== 'json') {
          console.log(chalk.green(`\n✅ Crawl complete. Found ${chalk.bold(nodes.length)} pages.`));
          console.log(chalk.gray(`   Snapshot ID: ${snapshotId}`));
          process.stdout.write(chalk.gray('🔍 Detecting duplicates... '));
      }

      detectDuplicates(graph, { collapse: argv.collapse });
      if (argv.format !== 'json') process.stdout.write(chalk.green('Done\n'));

      if (argv.format !== 'json') process.stdout.write(chalk.gray('🧩 Clustering content... '));
      detectContentClusters(graph,
        argv['cluster-threshold'],
        argv['min-cluster-size']
      );
      if (argv.format !== 'json') process.stdout.write(chalk.green('Done\n'));

      if (argv.format !== 'json') process.stdout.write(chalk.gray('📊 Calculating final report metrics... '));
      const metrics = calculateMetrics(graph, depth);
      if (argv.format !== 'json') process.stdout.write(chalk.green('Done\n'));

      const graphData = graph.toJSON();
      const orphanAnnotatedNodes = annotateOrphans(graphData.nodes, graphData.edges, {
        enabled: !!argv.orphans,
        severityEnabled: !!argv['orphan-severity'],
        includeSoftOrphans: !!argv['include-soft-orphans'],
        minInbound: Number.isNaN(minInbound) ? 2 : minInbound,
        rootUrl: graphData.nodes.find((node: any) => node.depth === 0)?.url
      });
      graphData.nodes = orphanAnnotatedNodes;

      // === Optional file exports ===
      const exportFormats = parseExportFormats(argv.export);

      if (exportFormats.length > 0) {
        const urlObj = new URL(url);
        const domainFolder = urlObj.hostname.replace('www.', '');
        const outputDir = path.join(path.resolve(argv.output), domainFolder);

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
      if (argv.format === 'json') {
        process.stdout.write(JSON.stringify(insightReport, null, 2));
      } else {
        process.stdout.write(renderInsightOutput(insightReport));
      }

      if (argv['score-breakdown'] && argv.format !== 'json') {
        console.log(renderScoreBreakdown(insightReport.health));
      }

      if (argv['log-level'] === 'verbose' && argv.format !== 'json') {
        console.log(chalk.bold('\nVerbose Crawl Stats'));
        console.log(`Fetched: ${graph.sessionStats.pagesFetched}`);
        console.log(`Cached: ${graph.sessionStats.pagesCached}`);
        console.log(`Skipped: ${graph.sessionStats.pagesSkipped}`);
        console.log(`Total Found: ${graph.sessionStats.totalFound}`);
      }

      if (argv.format !== 'json') {
          console.log(`\n💾 Data stored in database (snapshot #${snapshotId})`);
          if (exportFormats.length > 0) {
            const urlObj = new URL(url);
            const domainFolder = urlObj.hostname.replace('www.', '');
            const outputDir = path.join(path.resolve(argv.output), domainFolder);
            console.log(`📂 Exports saved to: ${chalk.blueBright(outputDir)}`);
          }
          console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
      }

      if (argv['fail-on-critical'] && hasCriticalIssues(insightReport)) {
        process.exit(1);
      }

    } catch (error) {
      controller.handle({ type: 'error', message: 'Error', error });
      process.exit(1);
    }
  }
};
