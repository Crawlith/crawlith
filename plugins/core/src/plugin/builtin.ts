import { detectContentClusters } from '../graph/cluster.js';
import { detectDuplicates } from '../graph/duplicate.js';
import { computePageRank } from '../graph/pagerank.js';
import { SimHash } from '../graph/simhash.js';
import { computeHITS } from '../scoring/hits.js';
import type { CrawlPlugin } from './types.js';

export const PageRankPlugin: CrawlPlugin = {
  name: 'pagerank',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph) {
    computePageRank(graph);
  }
};

export const HitsPlugin: CrawlPlugin = {
  name: 'hits',
  cli: { flag: 'compute-hits', optionalFor: ['crawl'] },
  async onMetricsPhase(graph) {
    computeHITS(graph);
  }
};

export const DuplicateDetectionPlugin: CrawlPlugin = {
  name: 'duplicate-detection',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph) {
    detectDuplicates(graph, { collapse: true });
  }
};

export const ContentClusteringPlugin: CrawlPlugin = {
  name: 'content-clustering',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph, ctx) {
    const threshold = Number((ctx.metadata?.clusterThreshold as number | undefined) ?? 10);
    const minClusterSize = Number((ctx.metadata?.minClusterSize as number | undefined) ?? 3);
    detectContentClusters(graph, threshold, minClusterSize);
  }
};

export const SimhashPlugin: CrawlPlugin = {
  name: 'simhash',
  cli: { defaultFor: ['crawl'] },
  async onMetricsPhase(graph) {
    for (const node of graph.getNodes()) {
      const tokens = node.url.toLowerCase().split(/\W+/).filter(Boolean);
      node.simhash = SimHash.generate(tokens).toString(16);
    }
  }
};

export const HeadingHealthPlugin: CrawlPlugin = {
  name: 'heading-health',
  cli: {
    flag: 'heading',
    description: 'Analyze heading structure',
    defaultFor: ['crawl'],
    optionalFor: ['page']
  },
  async onMetricsPhase(graph) {
    for (const node of graph.getNodes()) {
      const h1Count = node.h1Count ?? 0;
      const h2Count = node.h2Count ?? 0;
      node.headingHealthScore = h1Count === 1 ? Math.min(100, 70 + Math.min(h2Count, 3) * 10) : Math.max(0, 60 - Math.abs(h1Count - 1) * 20);
    }
  }
};

export const builtinPlugins: CrawlPlugin[] = [
  PageRankPlugin,
  HitsPlugin,
  DuplicateDetectionPlugin,
  ContentClusteringPlugin,
  SimhashPlugin,
  HeadingHealthPlugin,
];
