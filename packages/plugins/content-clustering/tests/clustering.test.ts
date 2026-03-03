import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '@crawlith/core';
import { ClusteringService } from '../src/Service.js';

describe('ClusteringService', () => {
    let service: ClusteringService;
    let graph: Graph;

    beforeEach(() => {
        service = new ClusteringService();
        graph = new Graph();
    });

    it('should detect clusters from nodes with similar simhashes', () => {
        const h1 = 0b101010n.toString();
        const h2 = 0b101011n.toString(); // distance 1
        const h3 = (0b1111111111111111n << 32n).toString(); // distance far

        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://b.com', 0, 200);
        graph.addNode('https://c.com', 0, 200);

        graph.updateNodeData('https://a.com', { simhash: h1 });
        graph.updateNodeData('https://b.com', { simhash: h2 });
        graph.updateNodeData('https://c.com', { simhash: h3 });

        const clusters = service.detectContentClusters(graph, 3, 2);

        expect(clusters.length).toBe(1);
        expect(clusters[0].nodes).toContain('https://a.com');
        expect(clusters[0].nodes).toContain('https://b.com');
        expect(clusters[0].nodes).not.toContain('https://c.com');
        expect(clusters[0].count).toBe(2);
    });

    it('should calculate shared path prefix correctly', () => {
        const h = 0b111111n.toString();
        graph.addNode('https://example.com/blog/p1', 0, 200);
        graph.addNode('https://example.com/blog/p2', 0, 200);
        graph.addNode('https://example.com/blog/p3', 0, 200);

        graph.updateNodeData('https://example.com/blog/p1', { simhash: h });
        graph.updateNodeData('https://example.com/blog/p2', { simhash: h });
        graph.updateNodeData('https://example.com/blog/p3', { simhash: h });

        const clusters = service.detectContentClusters(graph, 3, 3);
        expect(clusters[0].sharedPathPrefix).toBe('/blog');
    });

    it('should identify the best primary URL based on in-links', () => {
        const h = 0b111111n.toString();
        graph.addNode('https://example.com/p1', 0, 200);
        graph.addNode('https://example.com/p2', 0, 200);

        graph.updateNodeData('https://example.com/p1', { simhash: h });
        graph.updateNodeData('https://example.com/p2', { simhash: h });

        // Give p2 more in-links
        graph.nodes.get('https://example.com/p2')!.inLinks = 5;

        const clusters = service.detectContentClusters(graph, 3, 2);
        expect(clusters[0].primaryUrl).toBe('https://example.com/p2');
    });

    describe('Cluster Risk Heuristic', () => {
        it('should assign HIGH risk to clusters with identical titles', () => {
            const html = '<html><head><title>Duplicate Title</title></head><body>Content</body></html>';
            const h = 0b101010n.toString();

            graph.addNode('https://example.com/p1', 0, 200);
            graph.addNode('https://example.com/p2', 0, 200);
            graph.addNode('https://example.com/p3', 0, 200);

            graph.updateNodeData('https://example.com/p1', { simhash: h, html });
            graph.updateNodeData('https://example.com/p2', { simhash: h, html });
            graph.updateNodeData('https://example.com/p3', { simhash: h, html });

            const clusters = service.detectContentClusters(graph, 2, 2);

            expect(clusters.length).toBe(1);
            expect(clusters[0].risk).toBe('high');
        });

        it('should assign HIGH risk to clusters with identical H1s', () => {
            const h = 0b101010n.toString();

            graph.addNode('https://example.com/p1', 0, 200);
            graph.addNode('https://example.com/p2', 0, 200);
            graph.addNode('https://example.com/p3', 0, 200);

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

            const clusters = service.detectContentClusters(graph, 2, 2);

            expect(clusters.length).toBe(1);
            expect(clusters[0].risk).toBe('high');
        });

        it('should assign MEDIUM risk to large clusters even with unique titles', () => {
            const h = 0b101010n.toString();

            for (let i = 0; i < 12; i++) {
                const url = `https://example.com/p${i}`;
                graph.addNode(url, 0, 200);
                graph.updateNodeData(url, {
                    simhash: h,
                    html: `<html><head><title>Page ${i}</title></head><body><h1>Header ${i}</h1></body></html>`
                });
            }

            const clusters = service.detectContentClusters(graph, 2, 2);

            expect(clusters.length).toBe(1);
            expect(clusters[0].risk).toBe('medium');
        });
    });
});
