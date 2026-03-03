import { describe, it, expect } from 'vitest';
import { Graph } from '@crawlith/core';
import { PageRankService } from '../src/Service.js';

describe('PageRank Engine', () => {
    it('should calculate identical PageRank for a simple loop', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://b.com', 1, 200);
        graph.addEdge('https://a.com', 'https://b.com');
        graph.addEdge('https://b.com', 'https://a.com');

        const service = new PageRankService();
        const results = service.evaluate(graph);
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).pageRank = res.raw_rank;
            (node as any).pageRankScore = res.score;
        }
        const nodes = graph.getNodes();

        expect((nodes[0] as any).pageRank).toBeCloseTo(0.5, 4);
        expect((nodes[1] as any).pageRank).toBeCloseTo(0.5, 4);
        expect((nodes[0] as any).pageRankScore).toBe(100);
        expect((nodes[1] as any).pageRankScore).toBe(100);
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

        const service = new PageRankService();
        const results = service.evaluate(graph);
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).pageRank = res.raw_rank;
            (node as any).pageRankScore = res.score;
        }
        const nodes = graph.getNodes();

        const center = nodes.find(n => n.url.includes('center'))!;
        const leaves = nodes.filter(n => !n.url.includes('center'));

        expect((center as any).pageRankScore).toBe(100);
        leaves.forEach(leaf => {
            expect((leaf as any).pageRankScore).toBeLessThan(100);
            expect((leaf as any).pageRank!).toBeLessThan((center as any).pageRank!);
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

        const service = new PageRankService();
        const results = service.evaluate(graph);
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).pageRank = res.raw_rank;
            (node as any).pageRankScore = res.score;
        }

        const bodyTarget = graph.nodes.get('https://body-target.com')!;
        const footerTarget = graph.nodes.get('https://footer-target.com')!;

        expect((bodyTarget as any).pageRank!).toBeGreaterThan((footerTarget as any).pageRank!);
    });

    it('should handle sink nodes by redistributing rank', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://b.com', 1, 200); // b is a sink
        graph.addEdge('https://a.com', 'https://b.com');

        const service = new PageRankService();
        const results = service.evaluate(graph);
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).pageRank = res.raw_rank;
            (node as any).pageRankScore = res.score;
        }

        const nodeA = graph.nodes.get('https://a.com')!;
        const nodeB = graph.nodes.get('https://b.com')!;

        // Without redistribution, A would lose all rank.
        // With redistribution, A should still have some rank.
        expect((nodeA as any).pageRank).toBeGreaterThan(0);
        expect((nodeB as any).pageRank).toBeGreaterThan((nodeA as any).pageRank!);
    });

    it('should exclude noindex pages from receiving or passing rank', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://no-index.com', 1, 200);
        graph.nodes.get('https://no-index.com')!.noindex = true;

        graph.addEdge('https://a.com', 'https://no-index.com');

        const service = new PageRankService();
        const results = service.evaluate(graph);
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).pageRank = res.raw_rank;
            (node as any).pageRankScore = res.score;
        }

        const nodeA = graph.nodes.get('https://a.com')!;
        const nodeNoIndex = graph.nodes.get('https://no-index.com')!;

        expect((nodeNoIndex as any).pageRank).toBeUndefined();
        expect((nodeA as any).pageRank).toBe(1.0); // Only one eligible node
    });
});
