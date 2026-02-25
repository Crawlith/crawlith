import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { detectContentClusters } from '../src/graph/cluster.js';

describe('Cluster Risk Heuristic', () => {
    let graph: Graph;

    beforeEach(() => {
        graph = new Graph();
    });

    it('should assign HIGH risk to clusters with identical titles', () => {
        const html = '<html><head><title>Duplicate Title</title></head><body>Content</body></html>';
        const h = 0b101010n.toString();

        graph.addNode('https://example.com/p1', 0, 200);
        graph.addNode('https://example.com/p2', 0, 200);
        graph.addNode('https://example.com/p3', 0, 200);

        graph.updateNodeData('https://example.com/p1', { simhash: h, html });
        graph.updateNodeData('https://example.com/p2', { simhash: h, html });
        graph.updateNodeData('https://example.com/p3', { simhash: h, html });

        const clusters = detectContentClusters(graph, 2, 2);

        expect(clusters.length).toBe(1);
        expect(clusters[0].risk).toBe('high');
    });

    it('should assign HIGH risk to clusters with identical H1s', () => {
        const h = 0b101010n.toString();

        graph.addNode('https://example.com/p1', 0, 200);
        graph.addNode('https://example.com/p2', 0, 200);
        graph.addNode('https://example.com/p3', 0, 200);

        // Different titles, same H1
        graph.updateNodeData('https://example.com/p1', {
            simhash: h,
            html: '<html><head><title>Page 1</title></head><body><h1>Duplicate Header</h1></body></html>'
        });
        graph.updateNodeData('https://example.com/p2', {
            simhash: h,
            html: '<html><head><title>Page 2</title></head><body><h1>Duplicate Header</h1></body></html>'
        });
        graph.updateNodeData('https://example.com/p3', {
            simhash: h,
            html: '<html><head><title>Page 3</title></head><body><h1>Duplicate Header</h1></body></html>'
        });

        const clusters = detectContentClusters(graph, 2, 2);

        expect(clusters.length).toBe(1);
        expect(clusters[0].risk).toBe('high');
    });

    it('should assign LOW risk to small clusters with unique titles and H1s', () => {
        const h = 0b101010n.toString();

        graph.addNode('https://example.com/p1', 0, 200);
        graph.addNode('https://example.com/p2', 0, 200);
        graph.addNode('https://example.com/p3', 0, 200);

        graph.updateNodeData('https://example.com/p1', {
            simhash: h,
            html: '<html><head><title>Page 1</title></head><body><h1>Header 1</h1></body></html>'
        });
        graph.updateNodeData('https://example.com/p2', {
            simhash: h,
            html: '<html><head><title>Page 2</title></head><body><h1>Header 2</h1></body></html>'
        });
        graph.updateNodeData('https://example.com/p3', {
            simhash: h,
            html: '<html><head><title>Page 3</title></head><body><h1>Header 3</h1></body></html>'
        });

        const clusters = detectContentClusters(graph, 2, 2);

        expect(clusters.length).toBe(1);
        expect(clusters[0].risk).toBe('low');
    });

    it('should assign MEDIUM risk to large clusters even with unique titles', () => {
        const h = 0b101010n.toString();

        // 12 nodes, all unique titles
        for (let i = 0; i < 12; i++) {
            const url = `https://example.com/p${i}`;
            graph.addNode(url, 0, 200);
            graph.updateNodeData(url, {
                simhash: h,
                html: `<html><head><title>Page ${i}</title></head><body><h1>Header ${i}</h1></body></html>`
            });
        }

        const clusters = detectContentClusters(graph, 2, 2);

        expect(clusters.length).toBe(1);
        expect(clusters[0].risk).toBe('medium');
    });

    it('should handle missing HTML gracefully', () => {
         const h = 0b101010n.toString();

        graph.addNode('https://example.com/p1', 0, 200);
        graph.addNode('https://example.com/p2', 0, 200);

        // No HTML provided
        graph.updateNodeData('https://example.com/p1', { simhash: h });
        graph.updateNodeData('https://example.com/p2', { simhash: h });

        const clusters = detectContentClusters(graph, 2, 2);

        expect(clusters.length).toBe(1);
        // Fallback to size based? 2 nodes -> low risk
        expect(clusters[0].risk).toBe('low');
    });
});
