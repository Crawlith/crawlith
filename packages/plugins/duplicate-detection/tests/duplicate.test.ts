import { describe, it, expect, beforeEach } from 'vitest';
import { Graph, SimHash } from '@crawlith/core';
import { DuplicateService } from '../src/Service.js';

describe('Duplicate Detection', () => {
    let service: DuplicateService;
    let graph: Graph;

    beforeEach(() => {
        service = new DuplicateService();
        graph = new Graph();
    });

    it('should detect exact duplicates based on contentHash', () => {
        graph.addNode('https://example.com/a', 0, 200);
        graph.addNode('https://example.com/b', 0, 200);
        graph.addNode('https://example.com/c', 0, 200);

        graph.updateNodeData('https://example.com/a', { contentHash: 'hash1', uniqueTokenRatio: 1.0 });
        graph.updateNodeData('https://example.com/b', { contentHash: 'hash1', uniqueTokenRatio: 1.0 });
        graph.updateNodeData('https://example.com/c', { contentHash: 'hash2', uniqueTokenRatio: 1.0 });

        service.detectDuplicates(graph);

        const clusters = (graph as any).duplicateClusters;
        expect(clusters).toHaveLength(1);
        const cluster = clusters[0];
        expect(cluster.type).toBe('exact');
        expect(cluster.size).toBe(2);

        const nodeA = graph.nodes.get('https://example.com/a')!;
        const nodeB = graph.nodes.get('https://example.com/b')!;
        expect((nodeA as any).duplicateClusterId).toBeDefined();
        expect((nodeA as any).duplicateClusterId).toBe((nodeB as any).duplicateClusterId);

        // One should be primary, one should be collapsed
        expect(!(nodeA as any).isCollapsed !== !(nodeB as any).isCollapsed).toBe(true);
    });

    it('should detect near duplicates using SimHash', () => {
        graph.addNode('https://example.com/x', 0, 200);
        graph.addNode('https://example.com/y', 0, 200);

        const tokens1 = ['hello', 'world', 'this', 'is', 'a', 'test', 'document'];
        const tokens2 = ['hello', 'world', 'this', 'is', 'a', 'test', 'document2'];

        const h1 = SimHash.generate(tokens1);
        const h2 = SimHash.generate(tokens2);

        graph.updateNodeData('https://example.com/x', { contentHash: 'x', simhash: h1.toString(), uniqueTokenRatio: 1.0 });
        graph.updateNodeData('https://example.com/y', { contentHash: 'y', simhash: h2.toString(), uniqueTokenRatio: 1.0 });

        service.detectDuplicates(graph, { simhashThreshold: 10 });

        const clusters = (graph as any).duplicateClusters;
        expect(clusters).toHaveLength(1);
        expect(clusters[0].type).toBe('near');
    });

    it('should identify template-heavy clusters', () => {
        graph.addNode('https://example.com/1', 0, 200);
        graph.addNode('https://example.com/2', 0, 200);

        graph.updateNodeData('https://example.com/1', { contentHash: 'h1', uniqueTokenRatio: 0.2 });
        graph.updateNodeData('https://example.com/2', { contentHash: 'h1', uniqueTokenRatio: 0.2 });

        service.detectDuplicates(graph);

        const clusters = (graph as any).duplicateClusters;
        expect(clusters[0].type).toBe('template_heavy');
    });

    it('should mark high severity on missing canonicals', () => {
        graph.addNode('https://example.com/a', 0, 200);
        graph.addNode('https://example.com/b', 0, 200);

        graph.updateNodeData('https://example.com/a', { contentHash: 'h1', canonical: 'https://example.com/a' });
        graph.updateNodeData('https://example.com/b', { contentHash: 'h1', canonical: undefined });

        service.detectDuplicates(graph);

        const clusters = (graph as any).duplicateClusters;
        expect(clusters[0].severity).toBe('high');
    });

    it('should transfer edges during collapse', () => {
        graph.addNode('https://example.com/a', 0, 200);
        graph.addNode('https://example.com/b', 0, 200);
        graph.addNode('https://example.com/source', 0, 200);

        graph.updateNodeData('https://example.com/a', { contentHash: 'h1' });
        graph.updateNodeData('https://example.com/b', { contentHash: 'h1' });

        graph.addEdge('https://example.com/source', 'https://example.com/b', 1);

        graph.nodes.get('https://example.com/a')!.inLinks = 10;

        service.detectDuplicates(graph);

        const a = graph.nodes.get('https://example.com/a')!;
        const b = graph.nodes.get('https://example.com/b')!;

        expect((a as any).isClusterPrimary).toBe(true);
        expect((a as any).isCollapsed).toBe(false);
        expect((b as any).isCollapsed).toBe(true);
        expect((b as any).collapseInto).toBe('https://example.com/a');

        expect(graph.edges.has(Graph.getEdgeKey('https://example.com/source', 'https://example.com/a'))).toBe(true);
    });
});
