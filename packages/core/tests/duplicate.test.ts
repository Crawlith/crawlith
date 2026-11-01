import { test, expect } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { DuplicateService } from '../src/analysis/duplicate.js';

function graphWithPages(hashes: Record<string, string>): Graph {
  const graph = new Graph();
  for (const [url, contentHash] of Object.entries(hashes)) {
    graph.addNode(url, 1, 200);
    graph.updateNodeData(url, { contentHash, uniqueTokenRatio: 1 });
  }
  return graph;
}

test('re-running detection clears cluster state from pages that are no longer duplicates', () => {
  const graph = graphWithPages({ '/a': 'same', '/b': 'same', '/c': 'other' });
  const service = new DuplicateService();

  service.detectDuplicates(graph, { collapse: true });
  expect(graph.nodes.get('/b')?.duplicateClusterId).toBeDefined();

  // /b changes, so the /a + /b cluster no longer exists.
  graph.updateNodeData('/b', { contentHash: 'changed' });
  const clusters = service.detectDuplicates(graph, { collapse: true });

  expect(clusters).toHaveLength(0);
  for (const url of ['/a', '/b']) {
    const node = graph.nodes.get(url)!;
    expect(node.duplicateClusterId).toBeUndefined();
    expect(node.duplicateType).toBeUndefined();
    expect(node.isClusterPrimary).toBeUndefined();
    expect(node.isCollapsed).toBeUndefined();
    expect(node.collapseInto).toBeUndefined();
  }
  expect(graph.duplicateClusters).toEqual([]);
});
