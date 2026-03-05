import { describe, it, expect } from 'vitest';
import { PageRankService } from '../src/graph/pagerank.js';
import { Graph } from '../src/graph/graph.js';

describe('PageRank Performance Large', () => {
    it('benchmarks PageRank', () => {
        const graph = new Graph();
        const numNodes = 20000;
        const outDegree = 15;

        for (let i = 0; i < numNodes; i++) {
            graph.addNode(`https://example.com/page${i}`, 1, 200);
        }

        for (let i = 0; i < numNodes; i++) {
            for (let j = 0; j < outDegree; j++) {
                const target = Math.floor(Math.random() * numNodes);
                graph.addEdge(`https://example.com/page${i}`, `https://example.com/page${target}`);
            }
        }

        const pr = new PageRankService();

        const start = performance.now();
        pr.evaluate(graph, { maxIterations: 40 });
        const end = performance.now();

        console.log(`PageRank on ${numNodes} nodes with ${outDegree} edges each took ${end - start}ms`);
        expect(end - start).toBeLessThan(5000);
    });
});
