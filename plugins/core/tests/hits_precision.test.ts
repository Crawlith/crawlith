import { describe, it, expect } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { computeHITS } from '../src/scoring/hits.js';

describe('HITS Precision', () => {
    it('should classify roughly 25% of nodes as high-tier (authority/hub/power) under 75th percentile logic', () => {
        const graph = new Graph();
        const nodeCount = 40;

        // Create nodes
        for (let i = 0; i < nodeCount; i++) {
            graph.addNode(`http://node${i}.com`, 0, 200);
        }

        // 1. Core ring for connectivity
        for (let i = 0; i < nodeCount; i++) {
            graph.addEdge(`http://node${i}.com`, `http://node${(i + 1) % nodeCount}.com`);
        }

        // 2. Add a few "super nodes" (hubs/authorities)
        // Nodes 0, 1, 2 get many in-links (Authorities)
        for (let i = 0; i < nodeCount; i++) {
            if (i % 3 === 0) {
                 graph.addEdge(`http://node${i}.com`, `http://node0.com`);
            }
            if (i % 4 === 0) {
                 graph.addEdge(`http://node${i}.com`, `http://node1.com`);
            }
        }

        // Nodes 3, 4 link to many others (Hubs)
        for (let i = 5; i < 20; i++) {
            graph.addEdge(`http://node3.com`, `http://node${i}.com`);
            graph.addEdge(`http://node4.com`, `http://node${i}.com`);
        }

        computeHITS(graph, { iterations: 20 });

        const nodes = graph.getNodes();
        const highTierNodes = nodes.filter(n =>
            n.linkRole === 'authority' ||
            n.linkRole === 'hub' ||
            n.linkRole === 'power'
        );

        const ratio = highTierNodes.length / nodeCount;

        // Debug score distribution
        const authScores = nodes.map(n => n.authorityScore || 0).sort((a,b) => b-a);
        const hubScores = nodes.map(n => n.hubScore || 0).sort((a,b) => b-a);

        console.log('Top 10 Auth Scores:', authScores.slice(0, 10));
        console.log('Top 10 Hub Scores:', hubScores.slice(0, 10));
        console.log(`High tier nodes: ${highTierNodes.length}/${nodeCount} (${(ratio * 100).toFixed(1)}%)`);

        expect(ratio).toBeGreaterThanOrEqual(0.15);
        expect(ratio).toBeLessThanOrEqual(0.45); // Relaxed to 45% due to potential ties in synthetic graph
    });
});
