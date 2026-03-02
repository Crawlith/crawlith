import { crawl, type CrawlOptions } from '../crawler/crawl.js';
import { runPostCrawlMetrics } from '../crawler/metricsRunner.js';
import { analyzeSite, type AnalyzeOptions, type AnalysisResult } from '../analysis/analyze.js';
import { loadGraphFromSnapshot } from '../db/graphLoader.js';
import { compareGraphs } from '../diff/compare.js';
import { PluginRegistry } from '../plugin-system/plugin-registry.js';
import type { CrawlithPlugin, PluginContext } from '../plugin-system/plugin-types.js';
import type { UseCase } from './usecase.js';
import type { Graph } from '../graph/graph.js';
import type { EngineContext } from '../events.js';

export interface CrawlSitegraphResult {
  snapshotId: number;
  graph: Graph;
}

export interface SiteCrawlInput {
  url: string;
  limit?: number;
  depth?: number;
  concurrency?: number;
  stripQuery?: boolean;
  ignoreRobots?: boolean;
  sitemap?: string;
  debug?: boolean;
  detectSoft404?: boolean;
  detectTraps?: boolean;
  rate?: number;
  maxBytes?: number;
  allowedDomains?: string[];
  deniedDomains?: string[];
  includeSubdomains?: boolean;
  proxyUrl?: string;
  maxRedirects?: number;
  userAgent?: string;
  plugins?: CrawlithPlugin[];
  context?: PluginContext;
}

export class CrawlSitegraph implements UseCase<SiteCrawlInput, CrawlSitegraphResult> {
  async execute(input: SiteCrawlInput): Promise<CrawlSitegraphResult> {
    const ctx = input.context ?? { command: 'crawl' };
    const registry = new PluginRegistry(input.plugins ?? []);

    await registry.runHook('onInit', ctx);
    await registry.runHook('onCrawlStart', ctx);

    const policy = (ctx.metadata?.crawlPolicy || {}) as any;

    // Map the unified DTO into the underlying CrawlOptions
    const crawlOpts: any = { // Temporary any to avoid mismatch until crawl() is updated
      limit: input.limit ?? 500,
      depth: input.depth ?? 5,
      concurrency: input.concurrency,
      stripQuery: input.stripQuery,
      ignoreRobots: policy.ignoreRobots !== undefined ? policy.ignoreRobots : input.ignoreRobots,
      sitemap: input.sitemap,
      debug: input.debug,
      detectSoft404: input.detectSoft404,
      detectTraps: input.detectTraps,
      rate: policy.rate !== undefined ? policy.rate : input.rate,
      maxBytes: policy.maxBytes !== undefined ? policy.maxBytes : input.maxBytes,
      allowedDomains: policy.allowedDomains?.length ? policy.allowedDomains : input.allowedDomains,
      deniedDomains: policy.deniedDomains?.length ? policy.deniedDomains : input.deniedDomains,
      includeSubdomains: policy.includeSubdomains !== undefined ? policy.includeSubdomains : input.includeSubdomains,
      proxyUrl: policy.proxyUrl !== undefined ? policy.proxyUrl : input.proxyUrl,
      maxRedirects: policy.maxRedirects !== undefined ? policy.maxRedirects : input.maxRedirects,
      userAgent: policy.userAgent !== undefined ? policy.userAgent : input.userAgent,
      registry: registry
    };

    const snapshotId = await crawl(input.url, crawlOpts as any);
    const graph = loadGraphFromSnapshot(snapshotId);

    await registry.runHook('onGraphBuilt', ctx, graph);
    await registry.runHook('onMetrics', ctx, graph);

    runPostCrawlMetrics(snapshotId, crawlOpts.depth, undefined, false, graph, {
      computePageRank: false,
      computeHITS: false
    });

    await registry.runHook('onReport', ctx, { snapshotId, graph });
    return { snapshotId, graph };
  }
}

export class AnalyzeSnapshot implements UseCase<{ url: string; options: AnalyzeOptions; plugins?: CrawlithPlugin[]; context?: PluginContext }, AnalysisResult> {
  async execute(input: { url: string; options: AnalyzeOptions; plugins?: CrawlithPlugin[]; context?: PluginContext }): Promise<AnalysisResult> {
    const result = await analyzeSite(input.url, { ...input.options, live: false });

    if (input.plugins && input.plugins.length > 0) {
      const registry = new PluginRegistry(input.plugins);
      const ctx = input.context ?? { command: 'analyze' };
      await registry.runHook('onInit', ctx);
      await registry.runHook('onReport', ctx, result);
    }

    return result;
  }
}

export interface PageAnalysisInput {
  url: string;
  live?: boolean;
  snapshotId?: number;
  seo?: boolean;
  content?: boolean;
  accessibility?: boolean;
  rate?: number;
  proxyUrl?: string;
  userAgent?: string;
  maxRedirects?: number;
  clusterThreshold?: number;
  minClusterSize?: number;
  debug?: boolean;
  allPages?: boolean;
  plugins?: CrawlithPlugin[];
  context?: PluginContext;
}

export class PageAnalysisUseCase implements UseCase<PageAnalysisInput, AnalysisResult> {
  constructor(private readonly context?: EngineContext) { }

  async execute(input: PageAnalysisInput): Promise<AnalysisResult> {
    const result = await analyzeSite(input.url, {
      live: input.live,
      snapshotId: input.snapshotId,
      seo: input.seo,
      content: input.content,
      accessibility: input.accessibility,
      rate: input.rate,
      proxyUrl: input.proxyUrl,
      userAgent: input.userAgent,
      maxRedirects: input.maxRedirects,
      clusterThreshold: input.clusterThreshold,
      minClusterSize: input.minClusterSize,
      debug: input.debug,
      allPages: input.allPages,
      plugins: input.plugins,
      pluginContext: input.context
    }, this.context);

    return result;
  }
}


export class ExportReport implements UseCase<{ snapshotId: number }, string> {
  async execute(input: { snapshotId: number }): Promise<string> {
    return JSON.stringify(loadGraphFromSnapshot(input.snapshotId).toJSON());
  }
}

export class DiffSnapshots implements UseCase<{ oldSnapshotId: number; newSnapshotId: number }, ReturnType<typeof compareGraphs>> {
  async execute(input: { oldSnapshotId: number; newSnapshotId: number }) {
    return compareGraphs(loadGraphFromSnapshot(input.oldSnapshotId), loadGraphFromSnapshot(input.newSnapshotId));
  }
}
