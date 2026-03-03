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

    it('should test union-find rank balancing and path compression', () => {
        const graph = new Graph();
        // Create 4 near duplicate nodes to trigger union-find ranks
        graph.addNode('http://x.com/1', 0, 200);
        graph.addNode('http://x.com/2', 0, 200);
        graph.addNode('http://x.com/3', 0, 200);
        graph.addNode('http://x.com/4', 0, 200);

        const h1 = SimHash.generate(['a', 'b']);
        const h2 = SimHash.generate(['a', 'b', 'c']);
        const h3 = SimHash.generate(['a', 'b', 'd']);
        const h4 = SimHash.generate(['a', 'b', 'e']);

        graph.updateNodeData('http://x.com/1', { contentHash: '1', simhash: h1.toString(), uniqueTokenRatio: 1.0 });
        graph.updateNodeData('http://x.com/2', { contentHash: '2', simhash: h2.toString(), uniqueTokenRatio: 1.0 });
        graph.updateNodeData('http://x.com/3', { contentHash: '3', simhash: h3.toString(), uniqueTokenRatio: 1.0 });
        graph.updateNodeData('http://x.com/4', { contentHash: '4', simhash: h4.toString(), uniqueTokenRatio: 1.0 });

        // This should cause multiple unions and path compressions
        detectDuplicates(graph, { simhashThreshold: 64 });

        expect(graph.duplicateClusters).toHaveLength(1);
    });

    it('should assign medium severity for near duplicates', () => {
        const graph = new Graph();
        graph.addNode('http://x.com/1', 0, 200);
        graph.addNode('http://x.com/2', 0, 200);

        const h1 = SimHash.generate(['a', 'b']);
        const h2 = SimHash.generate(['a', 'b', 'c']);

        graph.updateNodeData('http://x.com/1', { contentHash: '1', simhash: h1.toString(), uniqueTokenRatio: 1.0, canonical: 'http://x.com/1' });
        graph.updateNodeData('http://x.com/2', { contentHash: '2', simhash: h2.toString(), uniqueTokenRatio: 1.0, canonical: 'http://x.com/1' });

        detectDuplicates(graph, { simhashThreshold: 64 });

        // They match canonical, so it falls back to type-based severity (near = medium)
        expect(graph.duplicateClusters[0].severity).toBe('medium');
    });

    it('should assign low severity for template heavy duplicates', () => {
        const graph = new Graph();
        graph.addNode('http://x.com/1', 0, 200);
        graph.addNode('http://x.com/2', 0, 200);

        graph.updateNodeData('http://x.com/1', { contentHash: '1', uniqueTokenRatio: 0.1, canonical: 'http://x.com/1' });
        graph.updateNodeData('http://x.com/2', { contentHash: '1', uniqueTokenRatio: 0.1, canonical: 'http://x.com/1' });

        detectDuplicates(graph);

        expect(graph.duplicateClusters[0].severity).toBe('low');
    });

    it('should test collapseEdges handling missing nodes and self links', () => {
        const graph = new Graph();
        graph.addNode('http://x.com/1', 0, 200);
        graph.addNode('http://x.com/2', 0, 200);

        graph.updateNodeData('http://x.com/1', { contentHash: '1', uniqueTokenRatio: 1.0 });
        graph.updateNodeData('http://x.com/2', { contentHash: '1', uniqueTokenRatio: 1.0 });

        // For targetNode missing
        graph.edges.set(Graph.getEdgeKey('http://x.com/1', 'http://missing.com'), 1.0);

        // For sourceNode missing
        graph.edges.set(Graph.getEdgeKey('http://missing.com', 'http://x.com/2'), 1.0);

        // For self link (actualSource === actualTarget)
        graph.edges.set(Graph.getEdgeKey('http://x.com/1', 'http://x.com/2'), 1.0);

        detectDuplicates(graph);

        // Now edges should be 0 because:
        // missing nodes skip
        // 1 -> 2 becomes 1 -> 1 (self link, skipped)
        expect(graph.getEdges().length).toBe(0);
    });

    it('should not collapse when collapse=false', () => {
        const graph = new Graph();
        graph.addNode('http://x.com/1', 0, 200);
        graph.addNode('http://x.com/2', 0, 200);
        graph.addEdge('http://x.com/2', 'http://x.com/1');

        graph.updateNodeData('http://x.com/1', { contentHash: '1', uniqueTokenRatio: 1.0 });
        graph.updateNodeData('http://x.com/2', { contentHash: '1', uniqueTokenRatio: 1.0 });

        detectDuplicates(graph, { collapse: false });

        expect(graph.nodes.get('http://x.com/2')!.isCollapsed).toBeFalsy();
        expect(graph.getEdges().length).toBe(1); // Edge remains
    });

    it('should calculate inLinks and outLinks correctly when collapsing edges', () => {
        const graph = new Graph();
        graph.addNode('http://x.com/1', 0, 200);
        graph.addNode('http://x.com/2', 0, 200);
        graph.addNode('http://y.com/1', 0, 200);

        graph.updateNodeData('http://x.com/1', { contentHash: '1', uniqueTokenRatio: 1.0 });
        graph.updateNodeData('http://x.com/2', { contentHash: '1', uniqueTokenRatio: 1.0 });

        // Force 2 to collapse into 1 by giving 1 more inLinks originally, so it's chosen as representative
        graph.nodes.get('http://x.com/1')!.inLinks = 10;

        graph.addEdge('http://y.com/1', 'http://x.com/2', 0.5); // Should remap to 1, outlink on y.com/1, inlink on x.com/1
        graph.addEdge('http://y.com/1', 'http://x.com/1', 1.5); // already to 1, should keep highest weight (1.5)

        detectDuplicates(graph);

        const edges = graph.getEdges();
        expect(edges.length).toBe(1);
        expect(edges[0].weight).toBe(1.5); // from 1.5 vs 0.5

        const y1 = graph.nodes.get('http://y.com/1')!;
        const x1 = graph.nodes.get('http://x.com/1')!;

        expect(y1.outLinks).toBe(1);
        expect(x1.inLinks).toBe(1);
    });
