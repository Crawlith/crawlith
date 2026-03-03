import { Graph } from '../graph/graph.js';
import { calculateMetrics } from '../graph/metrics.js';

export interface DiffResult {
  addedUrls: string[];
  removedUrls: string[];
  changedStatus: { url: string; oldStatus: number; newStatus: number }[];
  changedCanonical: { url: string; oldCanonical: string | null; newCanonical: string | null }[];

  metricDeltas: {
    structuralEntropy: number;
    orphanCount: number;
    crawlEfficiency: number;
  };
}

export function compareGraphs(oldGraph: Graph, newGraph: Graph): DiffResult {
  const oldNodes = new Map(oldGraph.getNodes().map(n => [n.url, n]));
  const newNodes = new Map(newGraph.getNodes().map(n => [n.url, n]));

  const addedUrls: string[] = [];
  const removedUrls: string[] = [];
  const changedStatus: { url: string; oldStatus: number; newStatus: number }[] = [];
  const changedCanonical: { url: string; oldCanonical: string | null; newCanonical: string | null }[] = [];


  // Added & Changed
  for (const [url, newNode] of newNodes) {
    const oldNode = oldNodes.get(url);
    if (!oldNode) {
      addedUrls.push(url);
    } else {
      // Changed Status
      if (oldNode.status !== newNode.status) {
        changedStatus.push({ url, oldStatus: oldNode.status, newStatus: newNode.status });
      }
      // Changed Canonical
      if (oldNode.canonical !== newNode.canonical) {
        changedCanonical.push({
          url,
          oldCanonical: oldNode.canonical || null,
          newCanonical: newNode.canonical || null
        });
      }

    }
  }

  // Removed
  for (const url of oldNodes.keys()) {
    if (!newNodes.has(url)) {
      removedUrls.push(url);
    }
  }

  // Metrics
  // maxDepth is ignored by current calculateMetrics implementation but required by signature
  const oldMetrics = calculateMetrics(oldGraph, 10);
  const newMetrics = calculateMetrics(newGraph, 10);

  const metricDeltas = {
    structuralEntropy: newMetrics.structuralEntropy - oldMetrics.structuralEntropy,
    orphanCount: newMetrics.orphanPages.length - oldMetrics.orphanPages.length,
    crawlEfficiency: newMetrics.crawlEfficiencyScore - oldMetrics.crawlEfficiencyScore
  };

  return {
    addedUrls,
    removedUrls,
    changedStatus,
    changedCanonical,
    metricDeltas
  };
}
