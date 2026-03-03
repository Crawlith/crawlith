import { Graph, GraphNode } from './graph.js';

export interface Metrics {
  totalPages: number;
  totalEdges: number;
  orphanPages: string[];
  nearOrphans: string[];
  deepPages: string[];
  topAuthorityPages: { url: string; authority: number }[];
  averageOutDegree: number;
  maxDepthFound: number;
  crawlEfficiencyScore: number;
  averageDepth: number;
  structuralEntropy: number;
  limitReached: boolean;
  sessionStats?: {
    pagesFetched: number;
    pagesCached: number;
    pagesSkipped: number;
    totalFound: number;
  };
}

export function calculateMetrics(graph: Graph, _maxDepth: number): Metrics {
  const nodes = graph.getNodes();
  const edges = graph.getEdges();

  const totalPages = nodes.length;
  const totalEdges = edges.length;

  // Identify broken nodes
  const brokenNodes = new Set(nodes.filter(n => n.status >= 400 || n.status === 0).map(n => n.url));

  // Pre-compute outgoing edges per node for faster lookup
  const outgoingEdges = new Map<string, string[]>();
  for (const edge of edges) {
    let targets = outgoingEdges.get(edge.source);
    if (!targets) {
      targets = [];
      outgoingEdges.set(edge.source, targets);
    }
    targets.push(edge.target);
  }

  // Populate brokenLinks per node
  for (const node of nodes) {
    const targets = outgoingEdges.get(node.url);
    if (targets) {
      const broken = targets.filter(targetUrl => brokenNodes.has(targetUrl));

      if (broken.length > 0) {
        node.brokenLinks = broken;
      }
    }
  }

  // Authority Score (per node)
  const maxInLinks = nodes.reduce((max, n) => Math.max(max, n.inLinks), 0);
  const getAuthority = (node: GraphNode) => {
    if (maxInLinks === 0) return 0;
    return Math.log(1 + node.inLinks) / Math.log(1 + maxInLinks);
  };

  // orphanPages: inLinks === 0 && depth > 0
  const orphanPages = nodes
    .filter(n => n.inLinks === 0 && n.depth > 0)
    .map(n => n.url);

  // nearOrphans: inLinks === 1 && depth >= 3
  const nearOrphans = nodes
    .filter(n => n.inLinks === 1 && n.depth >= 3)
    .map(n => n.url);

  // deepPages: depth >= 4
  const deepPages = nodes
    .filter(n => n.depth >= 4) // Per requirement
    .map(n => n.url);

  // crawlEfficiencyScore: 1 - (deepPagesCount / totalPages)
  const deepPagesCount = deepPages.length;
  const crawlEfficiencyScore = totalPages > 0 ? 1 - (deepPagesCount / totalPages) : 1;

  // averageDepth: sum(depth) / totalPages
  const sumDepth = nodes.reduce((acc, n) => acc + n.depth, 0);
  const averageDepth = totalPages > 0 ? sumDepth / totalPages : 0;

  // structuralEntropy: Shannon entropy over outDegree distribution
  const outDegreeCounts = new Map<number, number>();
  nodes.forEach(n => {
    outDegreeCounts.set(n.outLinks, (outDegreeCounts.get(n.outLinks) || 0) + 1);
  });

  let structuralEntropy = 0;
  if (totalPages > 0) {
    for (const count of outDegreeCounts.values()) {
      const p = count / totalPages;
      if (p > 0) {
        structuralEntropy -= p * Math.log2(p);
      }
    }
  }

  // topAuthorityPages: Top 10 by authority
  const topAuthorityPages = [...nodes]
    .map(n => ({ url: n.url, authority: getAuthority(n) }))
    .sort((a, b) => b.authority - a.authority)
    .slice(0, 10);

  const averageOutDegree = totalPages > 0 ? totalEdges / totalPages : 0;
  const maxDepthFound = nodes.reduce((max, n) => Math.max(max, n.depth), 0);

  return {
    totalPages,
    totalEdges,
    orphanPages,
    nearOrphans,
    deepPages,
    topAuthorityPages,
    averageOutDegree,
    maxDepthFound,
    crawlEfficiencyScore,
    averageDepth,
    structuralEntropy,
    limitReached: graph.limitReached,
    sessionStats: graph.sessionStats
  };
}
