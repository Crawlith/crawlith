import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../../src/graph/graph.js';

describe('Graph', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  it('should add a new node', () => {
    graph.addNode('http://example.com', 0, 200);
    const node = graph.nodes.get('http://example.com');
    expect(node).toBeDefined();
    expect(node?.depth).toBe(0);
    expect(node?.status).toBe(200);
  });

  it('should update existing node status if non-zero', () => {
    graph.addNode('http://example.com', 0, 0);
    graph.addNode('http://example.com', 1, 200); // Should update status, but not depth?
    // Wait, addNode implementation:
    // if (!existing) { ... } else { if (status !== 0) existing.status = status; }

    const node = graph.nodes.get('http://example.com');
    expect(node?.status).toBe(200);
    expect(node?.depth).toBe(0); // Depth should not change
  });

  it('should add an edge', () => {
    graph.addNode('http://a.com', 0);
    graph.addNode('http://b.com', 1);
    graph.addEdge('http://a.com', 'http://b.com', 0.5);

    const edgeKey = Graph.getEdgeKey('http://a.com', 'http://b.com');
    expect(graph.edges.has(edgeKey)).toBe(true);
    expect(graph.edges.get(edgeKey)).toBe(0.5);

    const source = graph.nodes.get('http://a.com');
    const target = graph.nodes.get('http://b.com');
    expect(source?.outLinks).toBe(1);
    expect(target?.inLinks).toBe(1);
  });

  it('should update edge weight if new weight is higher', () => {
    graph.addNode('http://a.com', 0);
    graph.addNode('http://b.com', 1);
    graph.addEdge('http://a.com', 'http://b.com', 0.5);
    graph.addEdge('http://a.com', 'http://b.com', 0.8);

    const edgeKey = Graph.getEdgeKey('http://a.com', 'http://b.com');
    expect(graph.edges.get(edgeKey)).toBe(0.8);

    // Should not increment link counts again
    const source = graph.nodes.get('http://a.com');
    expect(source?.outLinks).toBe(1);
  });

  it('should not update edge weight if new weight is lower', () => {
    graph.addNode('http://a.com', 0);
    graph.addNode('http://b.com', 1);
    graph.addEdge('http://a.com', 'http://b.com', 0.8);
    graph.addEdge('http://a.com', 'http://b.com', 0.5);

    const edgeKey = Graph.getEdgeKey('http://a.com', 'http://b.com');
    expect(graph.edges.get(edgeKey)).toBe(0.8);
  });

  it('should serialize to JSON and deserialize from JSON', () => {
    graph.addNode('http://a.com', 0, 200);
    graph.addNode('http://b.com', 1, 200);
    graph.addEdge('http://a.com', 'http://b.com', 1.0);
    graph.duplicateClusters = [{ id: '1', type: 'exact', size: 2, representative: 'http://a.com', severity: 'high' }];
    graph.contentClusters = [{ id: 1, count: 2, primaryUrl: 'http://a.com', risk: 'high' }];

    const json = graph.toJSON();
    const newGraph = Graph.fromJSON(json);

    expect(newGraph.nodes.size).toBe(2);
    expect(newGraph.edges.size).toBe(1);
    expect(newGraph.duplicateClusters).toHaveLength(1);
    expect(newGraph.contentClusters).toHaveLength(1);

    const nodeA = newGraph.nodes.get('http://a.com');
    expect(nodeA?.status).toBe(200);

    const edgeKey = Graph.getEdgeKey('http://a.com', 'http://b.com');
    expect(newGraph.edges.get(edgeKey)).toBe(1.0);
  });

  it('should handle partial JSON in fromJSON', () => {
    const json = {
      nodes: [{ url: 'http://a.com', depth: 0, status: 200, inLinks: 0, outLinks: 0 }],
      // missing edges, clusters
    };
    const newGraph = Graph.fromJSON(json);
    expect(newGraph.nodes.size).toBe(1);
    expect(newGraph.edges.size).toBe(0);
  });
});
