import { describe, it, expect } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { computePageRank } from '../src/graph/pagerank.js';

describe('PageRank Engine', () => {
    it('should calculate identical PageRank for a simple loop', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://b.com', 1, 200);
        graph.addEdge('https://a.com', 'https://b.com');
        graph.addEdge('https://b.com', 'https://a.com');

        computePageRank(graph);
        const nodes = graph.getNodes();

        expect(nodes[0].pageRank).toBeCloseTo(0.5, 4);
        expect(nodes[1].pageRank).toBeCloseTo(0.5, 4);
        expect(nodes[0].pageRankScore).toBe(100);
        expect(nodes[1].pageRankScore).toBe(100);
    });

    it('should identify the center of a star graph as most important', () => {
        const graph = new Graph();
        graph.addNode('https://center.com', 0, 200);
        graph.addNode('https://p1.com', 1, 200);
        graph.addNode('https://p2.com', 1, 200);
        graph.addNode('https://p3.com', 1, 200);

        // Star in: all link to center
        graph.addEdge('https://p1.com', 'https://center.com');
        graph.addEdge('https://p2.com', 'https://center.com');
        graph.addEdge('https://p3.com', 'https://center.com');

        computePageRank(graph);
        const nodes = graph.getNodes();

        const center = nodes.find(n => n.url.includes('center'))!;
        const leaves = nodes.filter(n => !n.url.includes('center'));

        expect(center.pageRankScore).toBe(100);
        leaves.forEach(leaf => {
            expect(leaf.pageRankScore).toBeLessThan(100);
            expect(leaf.pageRank!).toBeLessThan(center.pageRank!);
        });
    });

    it('should respect link weights (Body > Nav > Footer)', () => {
        const graph = new Graph();
        graph.addNode('https://source.com', 0, 200);
        graph.addNode('https://body-target.com', 1, 200);
        graph.addNode('https://footer-target.com', 1, 200);

        // Body weight 1.0, Footer weight 0.4
        graph.addEdge('https://source.com', 'https://body-target.com', 1.0);
        graph.addEdge('https://source.com', 'https://footer-target.com', 0.4);

        computePageRank(graph);

        const bodyTarget = graph.nodes.get('https://body-target.com')!;
        const footerTarget = graph.nodes.get('https://footer-target.com')!;

        expect(bodyTarget.pageRank!).toBeGreaterThan(footerTarget.pageRank!);
    });

    it('should handle sink nodes by redistributing rank', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://b.com', 1, 200); // b is a sink
        graph.addEdge('https://a.com', 'https://b.com');

        computePageRank(graph);

        const nodeA = graph.nodes.get('https://a.com')!;
        const nodeB = graph.nodes.get('https://b.com')!;

        // Without redistribution, A would lose all rank.
        // With redistribution, A should still have some rank.
        expect(nodeA.pageRank).toBeGreaterThan(0);
        expect(nodeB.pageRank).toBeGreaterThan(nodeA.pageRank!);
    });

    it('should exclude noindex pages from receiving or passing rank', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://no-index.com', 1, 200);
        graph.nodes.get('https://no-index.com')!.noindex = true;

        graph.addEdge('https://a.com', 'https://no-index.com');

        computePageRank(graph);

        const nodeA = graph.nodes.get('https://a.com')!;
        const nodeNoIndex = graph.nodes.get('https://no-index.com')!;

        expect(nodeNoIndex.pageRank).toBeUndefined();
        expect(nodeA.pageRank).toBe(1.0); // Only one eligible node
    });
});

    it('should exclude nodes with isCollapsed, soft404Score > threshold, mismatched canonical, status >= 400 or status 0', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://collapsed.com', 1, 200);
        graph.nodes.get('https://collapsed.com')!.isCollapsed = true;

        graph.addNode('https://soft404.com', 1, 200);
        graph.nodes.get('https://soft404.com')!.soft404Score = 0.9;

        graph.addNode('https://canonical.com', 1, 200);
        graph.nodes.get('https://canonical.com')!.canonical = 'https://other.com';

        graph.addNode('https://broken.com', 1, 404);

        graph.addNode('https://uncrawled.com', 1, 0);

        graph.addEdge('https://a.com', 'https://collapsed.com');
        graph.addEdge('https://a.com', 'https://soft404.com');
        graph.addEdge('https://a.com', 'https://canonical.com');
        graph.addEdge('https://a.com', 'https://broken.com');
        graph.addEdge('https://a.com', 'https://uncrawled.com');

        computePageRank(graph);

        const nodeA = graph.nodes.get('https://a.com')!;
        expect(nodeA.pageRank).toBe(1.0); // Only one eligible node
        expect(graph.nodes.get('https://collapsed.com')!.pageRank).toBeUndefined();
        expect(graph.nodes.get('https://soft404.com')!.pageRank).toBeUndefined();
        expect(graph.nodes.get('https://canonical.com')!.pageRank).toBeUndefined();
        expect(graph.nodes.get('https://broken.com')!.pageRank).toBeUndefined();
        expect(graph.nodes.get('https://uncrawled.com')!.pageRank).toBeUndefined();
    });

    it('should handle zero eligible nodes safely', () => {
        const graph = new Graph();
        graph.addNode('https://broken.com', 1, 404);

        computePageRank(graph);
        expect(graph.nodes.get('https://broken.com')!.pageRank).toBeUndefined();
    });

    it('should handle edges without weights (fallback to 1.0)', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://b.com', 1, 200);

        graph.addEdge('https://a.com', 'https://b.com');

        const edges = graph.getEdges();
        edges[0].weight = undefined as any;

        computePageRank(graph);
        expect(graph.nodes.get('https://a.com')!.pageRank).toBeGreaterThan(0);
        expect(graph.nodes.get('https://b.com')!.pageRank).toBeGreaterThan(0);
    });

    it('should run till max iterations if not converged', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://b.com', 1, 200);
        graph.addEdge('https://a.com', 'https://b.com');
        graph.addEdge('https://b.com', 'https://a.com');

        computePageRank(graph, { maxIterations: 1, convergenceThreshold: 1e-15 });
        expect(graph.nodes.get('https://a.com')!.pageRank).toBeDefined();
    });
