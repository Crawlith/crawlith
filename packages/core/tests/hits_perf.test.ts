import { describe, it, expect } from 'vitest';
import { HITSService } from '../src/graph/hits.js';
import { Graph } from '../src/graph/graph.js';

describe('HITS Performance', () => {
    it('benchmarks HITS', () => {
        const graph = new Graph();
        const numNodes = 5000;
        const outDegree = 10;

        for (let i = 0; i < numNodes; i++) {
            graph.addNode(`https://example.com/page${i}`, 1, 200);
        }

        for (let i = 0; i < numNodes; i++) {
            for (let j = 0; j < outDegree; j++) {
                const target = Math.floor(Math.random() * numNodes);
                graph.addEdge(`https://example.com/page${i}`, `https://example.com/page${target}`);
            }
        }

        const hits = new HITSService();

        const start = performance.now();
        hits.evaluate(graph, { iterations: 20 });
        const end = performance.now();

        console.log(`HITS on ${numNodes} nodes with ${outDegree} edges each took ${end - start}ms`);
        expect(end - start).toBeLessThan(1000);
    });
});
