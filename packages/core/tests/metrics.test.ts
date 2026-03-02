import { Graph } from '../src/graph/graph.js';
import { calculateMetrics } from '../src/graph/metrics.js';
import { test, expect } from 'vitest';

test('graph metrics basic', () => {
  const g = new Graph();

  // Structure:
  // A -> B
  // A -> C
  // B -> C
  // C -> A

  g.addNode('A', 0, 200);
  g.addNode('B', 1, 200);
  g.addNode('C', 1, 200);

  g.addEdge('A', 'B');
  g.addEdge('A', 'C');
  g.addEdge('B', 'C');
  g.addEdge('C', 'A');

  const metrics = calculateMetrics(g, 5);

  expect(metrics.totalPages).toBe(3);
  expect(metrics.totalEdges).toBe(4);

  // Check degrees on nodes directly
  const nodeA = g.nodes.get('A');
  expect(nodeA?.inLinks).toBe(1);
  expect(nodeA?.outLinks).toBe(2);

  const nodeC = g.nodes.get('C');
  expect(nodeC?.inLinks).toBe(2);
  expect(nodeC?.outLinks).toBe(1);

  expect(metrics.averageOutDegree).toBeCloseTo(4/3);

  // Top authority should be C with 2 in-links, authority = 1
  expect(metrics.topAuthorityPages[0].url).toBe('C');
  expect(metrics.topAuthorityPages[0].authority).toBeCloseTo(1);

  // Max depth found
  expect(metrics.maxDepthFound).toBe(1);

  // Orphan pages (none)
  expect(metrics.orphanPages).toEqual([]);
});

test('orphan pages', () => {
  const g = new Graph();
  g.addNode('Root', 0, 200);
  g.addNode('Orphan', 1, 200);
  // Orphan is at depth 1 but no incoming edges recorded (maybe missed or filtered)

  const metrics = calculateMetrics(g, 5);
  expect(metrics.orphanPages).toContain('Orphan');
  expect(metrics.orphanPages).not.toContain('Root');
});
test('metrics v2 calculations', () => {
  const g = new Graph();

  // Root (depth 0, in=0, out=2)
  g.addNode('root', 0, 200);

  // A (depth 1, in=1, out=1)
  g.addNode('A', 1, 200);
  g.addEdge('root', 'A');

  // B (depth 1, in=1, out=0)
  g.addNode('B', 1, 200);
  g.addEdge('root', 'B');

  // C (depth 2, in=1, out=0)
  g.addNode('C', 2, 200);
  g.addEdge('A', 'C');

  // Orphan (depth 1, in=0) - e.g. added but no edge to it?
  // If it's in graph with depth > 0 and inLinks=0, it's an orphan.
  g.addNode('orphan', 1, 200);

  // Near Orphan (depth 3, in=1)
  g.addNode('D', 2, 200);
  g.addNode('nearOrphan', 3, 200);
  g.addEdge('C', 'D'); // C->D
  g.addEdge('D', 'nearOrphan'); // D->nearOrphan

  // Deep page (depth 4)
  g.addNode('deep', 4, 200);
  g.addEdge('nearOrphan', 'deep');

  // Nodes: root(0), A(1), B(1), C(2), orphan(1), D(2), nearOrphan(3), deep(4)
  // Total pages: 8

  // Edges: root->A, root->B, A->C, C->D, D->nearOrphan, nearOrphan->deep
  // Total edges: 6

  // InLinks:
  // root: 0
  // A: 1
  // B: 1
  // C: 1
  // orphan: 0
  // D: 1
  // nearOrphan: 1
  // deep: 1

  // Max InLinks = 1.
  // Authority Score = log(1 + in) / log(1 + maxIn)
  // If maxIn = 1, log(2).
  // For A: log(2)/log(2) = 1.
  // For root: log(1)/log(2) = 0.

  // Let's make maxIn > 1 to test better.
  g.addNode('popular', 1, 200);
  g.addEdge('root', 'popular');
  g.addEdge('A', 'popular');
  // popular inLinks = 2. MaxIn = 2.
  // Authority popular = log(3)/log(3) = 1.
  // Authority A = log(2)/log(3) approx 0.63

  const metrics = calculateMetrics(g, 10); // maxDepth arg (not used for calculation logic of deepPages which is hardcoded >=4 per prompt?)
  // Prompt says "deepPages: depth >= 4".
  // Existing calculateMetrics takes maxDepth arg.
  // Existing: deepPages = nodes.filter(n => n.depth >= maxDepth)
  // New requirement: deepPages: depth >= 4.
  // I should probably ignore the argument or update the requirement interpretation.
  // "deepPages: depth >= 4" implies fixed threshold.

  // Orphan pages: inLinks === 0 && depth > 0
  expect(metrics.orphanPages).toContain('orphan');
  expect(metrics.orphanPages).not.toContain('root'); // depth 0

  // Near orphans: inLinks === 1 && depth >= 3
  expect(metrics.nearOrphans).toContain('nearOrphan'); // depth 3, in 1
  expect(metrics.nearOrphans).toContain('deep'); // depth 4, in 1 (from nearOrphan)
  expect(metrics.nearOrphans).not.toContain('D'); // depth 2

  // Deep pages: depth >= 4
  expect(metrics.deepPages).toContain('deep');
  expect(metrics.deepPages).not.toContain('nearOrphan');

  // Crawl Efficiency Score: 1 - (deepPagesCount / totalPages)
  // Total: 9 nodes (root, A, B, C, orphan, D, nearOrphan, deep, popular)
  // Deep: 1 (deep)
  // Score: 1 - 1/9 = 8/9 = 0.888...
  expect(metrics.crawlEfficiencyScore).toBeCloseTo(8/9);

  // Average Depth: sum(depth) / totalPages
  // Depths: 0, 1, 1, 2, 1, 2, 3, 4, 1
  // Sum: 15
  // Avg: 15/9 = 1.666...
  expect(metrics.averageDepth).toBeCloseTo(15/9);

  // Structural Entropy
  // OutDegrees:
  // root: 3 (A, B, popular)
  // A: 2 (C, popular)
  // B: 0
  // C: 1 (D)
  // orphan: 0
  // D: 1 (nearOrphan)
  // nearOrphan: 1 (deep)
  // deep: 0
  // popular: 0

  // Distribution:
  // 0: 4 nodes (B, orphan, deep, popular)
  // 1: 3 nodes (C, D, nearOrphan)
  // 2: 1 node (A)
  // 3: 1 node (root)

  // P(0) = 4/9
  // P(1) = 3/9
  // P(2) = 1/9
  // P(3) = 1/9

  // Entropy = - (4/9 log2(4/9) + 3/9 log2(3/9) + 1/9 log2(1/9) + 1/9 log2(1/9))
  // = - (0.444 * -1.17 + 0.333 * -1.58 + 0.111 * -3.17 + 0.111 * -3.17)
  // approx 1.75

  // Let's compute exact expected value
  const p0 = 4/9;
  const p1 = 3/9;
  const p2 = 1/9;
  const p3 = 1/9;
  const entropy = - (p0 * Math.log2(p0) + p1 * Math.log2(p1) + p2 * Math.log2(p2) + p3 * Math.log2(p3));

  expect(metrics.structuralEntropy).toBeCloseTo(entropy);

  // Limit Reached
  expect(metrics.limitReached).toBe(false);
  g.limitReached = true;
  const metrics2 = calculateMetrics(g, 10);
  expect(metrics2.limitReached).toBe(true);
});

test('calculateMetrics on large graphs (Performance Test)', { timeout: 15000 }, () => {
  const g = new Graph();
  const numNodes = 5000;

  // Create nodes
  for (let i = 0; i < numNodes; i++) {
    // 10% of nodes are broken (status 404)
    const status = i % 10 === 0 ? 404 : 200;
    g.addNode(`node_${i}`, 1, status);
  }

  // Create edges: each node points to 10 other random nodes
  for (let i = 0; i < numNodes; i++) {
    for (let j = 0; j < 10; j++) {
      const targetIndex = Math.floor(Math.random() * numNodes);
      g.addEdge(`node_${i}`, `node_${targetIndex}`);
    }
  }

  const start = performance.now();
  calculateMetrics(g, 5);
  const end = performance.now();

  const duration = end - start;
  console.log(`calculateMetrics on ${numNodes} nodes took ${duration.toFixed(2)}ms`);

  // We just want to ensure it finishes without errors
  expect(duration).toBeGreaterThan(0);
});
