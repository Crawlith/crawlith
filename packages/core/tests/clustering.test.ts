import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { detectContentClusters } from '../src/graph/cluster.js';

describe('Content Clustering', () => {
    let graph: Graph;

    beforeEach(() => {
        graph = new Graph();
    });

    it('should group similar pages into a cluster', () => {
        // Mock simhashes for similar pages (Hamming distance 1)
        const h1 = 0b101010n;
        const h2 = 0b101011n;
        const h3 = 0b101001n;

        graph.addNode('https://example.com/p1', 0, 200);
        graph.addNode('https://example.com/p2', 0, 200);
        graph.addNode('https://example.com/p3', 0, 200);

        graph.updateNodeData('https://example.com/p1', { simhash: h1.toString() });
        graph.updateNodeData('https://example.com/p2', { simhash: h2.toString() });
        graph.updateNodeData('https://example.com/p3', { simhash: h3.toString() });

        const clusters = detectContentClusters(graph, 2, 2);

        expect(clusters.length).toBe(1);
        expect(clusters[0].count).toBe(3);
        expect(graph.nodes.get('https://example.com/p1')?.clusterId).toBe(1);
    });

    it('should separate dissimilar pages', () => {
        // Mock simhashes for very different pages
        const h1 = 0b1111111111n;
        const h2 = 0b0000000000n;

        graph.addNode('https://example.com/p1', 0, 200);
        graph.addNode('https://example.com/p2', 0, 200);

        graph.updateNodeData('https://example.com/p1', { simhash: h1.toString() });
        graph.updateNodeData('https://example.com/p2', { simhash: h2.toString() });

        const clusters = detectContentClusters(graph, 2, 2);

        expect(clusters.length).toBe(0); // None meet minSize 2
    });

    it('should respect minClusterSize', () => {
        const h1 = 0b1n;
        const h2 = 0b0n;

        graph.addNode('https://example.com/p1', 0, 200);
        graph.addNode('https://example.com/p2', 0, 200);

        graph.updateNodeData('https://example.com/p1', { simhash: h1.toString() });
        graph.updateNodeData('https://example.com/p2', { simhash: h2.toString() });

        const clusters = detectContentClusters(graph, 1, 3);
        expect(clusters.length).toBe(0);
    });

    it('should identify shared path prefixes (silos)', () => {
        graph.addNode('https://example.com/blog/seo-tips', 0, 200);
        graph.addNode('https://example.com/blog/link-building', 0, 200);
        graph.addNode('https://example.com/blog/technical-seo', 0, 200);

        const h = 0b111n;
        graph.updateNodeData('https://example.com/blog/seo-tips', { simhash: h.toString() });
        graph.updateNodeData('https://example.com/blog/link-building', { simhash: h.toString() });
        graph.updateNodeData('https://example.com/blog/technical-seo', { simhash: h.toString() });

        const clusters = detectContentClusters(graph, 0, 3);
        expect(clusters[0].sharedPathPrefix).toBe('/blog');
    });

    it('should be deterministic with unstable input order', () => {
        // We'll add nodes in different orders and check if cluster primary is same
        const h = 0b111n;
        graph.addNode('https://example.com/z', 0, 200);
        graph.addNode('https://example.com/a', 0, 200);
        graph.addNode('https://example.com/m', 0, 200);

        graph.updateNodeData('https://example.com/z', { simhash: h.toString(), pageRank: 10 });
        graph.updateNodeData('https://example.com/a', { simhash: h.toString(), pageRank: 10 });
        graph.updateNodeData('https://example.com/m', { simhash: h.toString(), pageRank: 10 });

        const clusters = detectContentClusters(graph, 0, 3);
        // a should be primary because it's shortest/lexicographic first since PageRanks are same
        expect(clusters[0].primaryUrl).toBe('https://example.com/a');
    });

    it('should use band optimization correctly (heuristic nature)', () => {
        // Create many nodes in 2 groups
        // Group 1: Matches in band 0
        // Group 2: Matches in band 1
        for (let i = 0; i < 5; i++) {
            const url = `https://example.com/g1/${i}`;
            graph.addNode(url, 0, 200);
            // Simhash that matches in first 16 bits (0xAAAA)
            const hash = BigInt(0xAAAA) | (BigInt(i) << 16n);
            graph.updateNodeData(url, { simhash: hash.toString() });
        }

        for (let i = 0; i < 5; i++) {
            const url = `https://example.com/g2/${i}`;
            graph.addNode(url, 0, 200);
            // Simhash that matches in second 16 bits (0xBBBB << 16)
            const hash = (BigInt(0xBBBB) << 16n) | BigInt(i);
            graph.updateNodeData(url, { simhash: hash.toString() });
        }

        const clusters = detectContentClusters(graph, 5, 3);
        expect(clusters.length).toBe(2);
        expect(clusters[0].count).toBe(5);
        expect(clusters[1].count).toBe(5);
    });
});
