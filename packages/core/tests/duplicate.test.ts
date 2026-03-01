import { describe, it, expect } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { detectDuplicates } from '../src/graph/duplicate.js';
import { SimHash } from '../src/graph/simhash.js';

describe('Duplicate Detection', () => {
    it('should detect exact duplicates based on contentHash', () => {
        const graph = new Graph();
        graph.addNode('https://example.com/a', 0, 200);
        graph.addNode('https://example.com/b', 0, 200);
        graph.addNode('https://example.com/c', 0, 200);

        graph.updateNodeData('https://example.com/a', { contentHash: 'hash1', uniqueTokenRatio: 1.0 });
        graph.updateNodeData('https://example.com/b', { contentHash: 'hash1', uniqueTokenRatio: 1.0 });
        graph.updateNodeData('https://example.com/c', { contentHash: 'hash2', uniqueTokenRatio: 1.0 });

        detectDuplicates(graph);

        expect(graph.duplicateClusters).toHaveLength(1);
        const cluster = graph.duplicateClusters[0];
        expect(cluster.type).toBe('exact');
        expect(cluster.size).toBe(2);

        const nodeA = graph.nodes.get('https://example.com/a')!;
        const nodeB = graph.nodes.get('https://example.com/b')!;
        expect(nodeA.duplicateClusterId).toBeDefined();
        expect(nodeA.duplicateClusterId).toBe(nodeB.duplicateClusterId);

        // One should be primary, one should be collapsed
        expect(!nodeA.isCollapsed !== !nodeB.isCollapsed).toBe(true);
    });

    it('should detect near duplicates using SimHash', () => {
        const graph = new Graph();
        graph.addNode('https://example.com/x', 0, 200);
        graph.addNode('https://example.com/y', 0, 200);

        // Calculate simhashes that are 1 bit apart
        const tokens1 = ['hello', 'world', 'this', 'is', 'a', 'test', 'document'];
        const tokens2 = ['hello', 'world', 'this', 'is', 'a', 'test', 'document2'];

        const h1 = SimHash.generate(tokens1);
        const h2 = SimHash.generate(tokens2);

        // Assume standard text gives < 3 diff. For reliability in test, we'll manually set string bigint representations.
        // Actually, we can just use the calculated ones.
        graph.updateNodeData('https://example.com/x', { contentHash: 'x', simhash: h1.toString(), uniqueTokenRatio: 1.0 });
        graph.updateNodeData('https://example.com/y', { contentHash: 'y', simhash: h2.toString(), uniqueTokenRatio: 1.0 });

        detectDuplicates(graph, { simhashThreshold: 10 }); // use high threshold to guarantee match

        expect(graph.duplicateClusters).toHaveLength(1);
        expect(graph.duplicateClusters[0].type).toBe('near');
    });

    it('should identify template-heavy clusters', () => {
        const graph = new Graph();
        graph.addNode('https://example.com/1', 0, 200);
        graph.addNode('https://example.com/2', 0, 200);

        graph.updateNodeData('https://example.com/1', { contentHash: 'h1', uniqueTokenRatio: 0.2 });
        graph.updateNodeData('https://example.com/2', { contentHash: 'h1', uniqueTokenRatio: 0.2 });

        detectDuplicates(graph);

        expect(graph.duplicateClusters[0].type).toBe('template_heavy');
    });

    it('should mark high severity on missing canonicals', () => {
        const graph = new Graph();
        graph.addNode('https://example.com/a', 0, 200);
        graph.addNode('https://example.com/b', 0, 200);

        graph.updateNodeData('https://example.com/a', { contentHash: 'h1', canonical: 'https://example.com/a' });
        graph.updateNodeData('https://example.com/b', { contentHash: 'h1', canonical: undefined }); // missing

        detectDuplicates(graph);

        expect(graph.duplicateClusters[0].severity).toBe('high');
    });

    it('should transfer edges during collapse', () => {
        const graph = new Graph();
        graph.addNode('https://example.com/a', 0, 200);
        graph.addNode('https://example.com/b', 0, 200);
        graph.addNode('https://example.com/source', 0, 200);

        graph.updateNodeData('https://example.com/a', { contentHash: 'h1' });
        graph.updateNodeData('https://example.com/b', { contentHash: 'h1' });

        // Add edge pointing to B
        graph.addEdge('https://example.com/source', 'https://example.com/b', 1);

        // Force A to be the representative by giving it higher inLinks manually, though it's determined dynamically
        graph.nodes.get('https://example.com/a')!.inLinks = 10;

        detectDuplicates(graph);

        const a = graph.nodes.get('https://example.com/a')!;
        const b = graph.nodes.get('https://example.com/b')!;

        expect(a.isClusterPrimary).toBe(true);
        expect(a.isCollapsed).toBe(false);
        expect(b.isCollapsed).toBe(true);
        expect(b.collapseInto).toBe('https://example.com/a');

        // Check edge transfer
        expect(graph.edges.has(Graph.getEdgeKey('https://example.com/source', 'https://example.com/a'))).toBe(true);
    });
});
