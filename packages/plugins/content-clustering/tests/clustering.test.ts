import { describe, it, expect, beforeEach } from 'vitest';
import { Graph, SimHash } from '@crawlith/core';
import { ClusteringService } from '../src/Service.js';

describe('ClusteringService', () => {
    let service: ClusteringService;
    let graph: Graph;

    beforeEach(() => {
        service = new ClusteringService();
        graph = new Graph();
    });

    it('should detect clusters of near-duplicate pages', () => {
        // Create 3 pages with very similar simhashes
        // SimHash 64-bit integer
        const hash1 = 0b1111111111111111000000000000000011111111111111110000000000000000n;
        const hash2 = 0b1111111111111111000000000000000011111111111111110000000000000001n; // Hamming dist 1
        const hash3 = 0b1111111111111111000000000000000011111111111111110000000000000011n; // Hamming dist 2

        graph.addNode('https://example.com/p1', 1, 200);
        graph.addNode('https://example.com/p2', 1, 200);
        graph.addNode('https://example.com/p3', 1, 200);
        graph.addNode('https://example.com/p4', 1, 200); // Unique

        graph.updateNodeData('https://example.com/p1', { simhash: hash1.toString(), inLinks: 10 });
        graph.updateNodeData('https://example.com/p2', { simhash: hash2.toString(), inLinks: 5 });
        graph.updateNodeData('https://example.com/p3', { simhash: hash3.toString(), inLinks: 2 });
        graph.updateNodeData('https://example.com/p4', { simhash: (hash1 ^ 0xFFFFFFFFFFFFFFFFn).toString(), inLinks: 1 });

        const clusters = service.detectContentClusters(graph, 5, 3);

        expect(clusters).toHaveLength(1);
        expect(clusters[0].count).toBe(3);
        expect(clusters[0].primaryUrl).toBe('https://example.com/p1'); // Highest inLinks
    });

    it('should ignore pages below minSize', () => {
        const hash1 = 123456789n;
        const hash2 = 123456788n;

        graph.addNode('https://example.com/p1', 1, 200);
        graph.addNode('https://example.com/p2', 1, 200);

        graph.updateNodeData('https://example.com/p1', { simhash: hash1.toString() });
        graph.updateNodeData('https://example.com/p2', { simhash: hash2.toString() });

        const clusters = service.detectContentClusters(graph, 10, 3);
        expect(clusters).toHaveLength(0);
    });

    it('should calculate shared path prefix', () => {
        graph.addNode('https://example.com/blog/p1', 1, 200);
        graph.addNode('https://example.com/blog/p2', 1, 200);
        graph.addNode('https://example.com/blog/p3', 1, 200);

        const h = 100n;
        graph.updateNodeData('https://example.com/blog/p1', { simhash: h.toString() });
        graph.updateNodeData('https://example.com/blog/p2', { simhash: h.toString() });
        graph.updateNodeData('https://example.com/blog/p3', { simhash: h.toString() });

        const clusters = service.detectContentClusters(graph, 5, 3);
        expect(clusters[0].sharedPathPrefix).toBe('/blog');
    });
});
