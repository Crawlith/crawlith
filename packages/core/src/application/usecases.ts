import { crawl, type CrawlOptions } from '../crawler/crawl.js';
import { runPostCrawlMetrics } from '../crawler/metricsRunner.js';
import { analyzeSite, type AnalyzeOptions, type AnalysisResult } from '../analysis/analyze.js';
import { loadGraphFromSnapshot } from '../db/graphLoader.js';
import { compareGraphs } from '../diff/compare.js';
import { PluginManager } from '../plugin/manager.js';
import type { CrawlPlugin, MetricsContext, PluginContext } from '../plugin/types.js';
import type { UseCase } from './usecase.js';
import type { Graph } from '../graph/graph.js';
import type { EngineContext } from '../events.js';

export interface CrawlSitegraphResult {
  snapshotId: number;
  graph: Graph;
}

export class CrawlSitegraph implements UseCase<{ url: string; options: CrawlOptions; plugins?: CrawlPlugin[]; context?: PluginContext }, CrawlSitegraphResult> {
  async execute(input: { url: string; options: CrawlOptions; plugins?: CrawlPlugin[]; context?: PluginContext }): Promise<CrawlSitegraphResult> {
    const ctx = input.context ?? { command: 'crawl' };
    const pm = new PluginManager(input.plugins ?? [], {
      debug: (message: string) => ctx.logger?.info?.(message)
    });

    await pm.init(ctx);
    await pm.runHook('onBeforeCrawl', { ...ctx, command: 'crawl' });

    const snapshotId = await crawl(input.url, input.options);
    const graph = loadGraphFromSnapshot(snapshotId);

    await pm.runHook('onGraphBuilt', graph, { ...ctx, command: 'crawl', snapshotId });

    const metricsCtx: MetricsContext = {
      ...ctx,
      command: 'crawl',
      snapshotId,
      metadata: {
        ...(ctx.metadata ?? {}),
        clusterThreshold: (input.options as any).clusterThreshold,
        minClusterSize: (input.options as any).minClusterSize,
      }
    };
    await pm.runHook('onMetricsPhase', graph, metricsCtx);

    runPostCrawlMetrics(snapshotId, input.options.depth, undefined, false, graph, {
      computePageRank: false,
      computeHITS: false
    });

    await pm.runHook('onAfterCrawl', { ...ctx, command: 'crawl', snapshotId });
    return { snapshotId, graph };
  }
}

export class AnalyzeSnapshot implements UseCase<{ url: string; options: AnalyzeOptions }, AnalysisResult> {
  async execute(input: { url: string; options: AnalyzeOptions }): Promise<AnalysisResult> {
    return analyzeSite(input.url, { ...input.options, live: false });
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
}

export class PageAnalysisUseCase implements UseCase<PageAnalysisInput, AnalysisResult> {
  constructor(private readonly context?: EngineContext) { }

  async execute(input: PageAnalysisInput): Promise<AnalysisResult> {
    return analyzeSite(input.url, {
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
    }, this.context);
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
