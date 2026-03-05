import { describe, it, expect } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { PageRankService } from '../src/graph/pagerank.js';

describe('PageRankService', () => {
  it('returns neutral score when graph has no rank spread', () => {
    const graph = new Graph();
    graph.addNode('/only', 0, 200);

    const pr = new PageRankService().evaluate(graph);
    const only = pr.get('/only');

    expect(only).toBeDefined();
    expect(only?.score).toBe(50);
  });

  it('still returns normalized spread when ranks differ', () => {
    const graph = new Graph();
    graph.addNode('/a', 0, 200);
    graph.addNode('/b', 1, 200);
    graph.addNode('/c', 1, 200);

    graph.addEdge('/a', '/b');
    graph.addEdge('/a', '/c');
    graph.addEdge('/b', '/c');

    const pr = new PageRankService().evaluate(graph);
    const scores = ['/a', '/b', '/c'].map((u) => pr.get(u)?.score ?? 0);

    expect(Math.max(...scores)).toBeGreaterThan(Math.min(...scores));
  });
});
