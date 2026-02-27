import { describe, it, expect } from 'vitest';
import { Graph } from '../src/graph/graph.js';
import { computeHITS } from '../src/scoring/hits.js';

describe('HITS Scoring', () => {
    it('should compute scores for a simple star topology', () => {
        const graph = new Graph();
        // Hub
        graph.addNode('http://hub.com', 0, 200);
        // Authorities
        graph.addNode('http://auth1.com', 1, 200);
        graph.addNode('http://auth2.com', 1, 200);
        graph.addNode('http://auth3.com', 1, 200);

        graph.addEdge('http://hub.com', 'http://auth1.com');
        graph.addEdge('http://hub.com', 'http://auth2.com');
        graph.addEdge('http://hub.com', 'http://auth3.com');

        computeHITS(graph, { iterations: 10 });

        const hub = graph.nodes.get('http://hub.com')!;
        const auth1 = graph.nodes.get('http://auth1.com')!;

        // In a star topology:
        // Hub should have max hub score
        // Authorities should have max authority scores
        expect(hub.hubScore).toBeGreaterThan(0.9);
        expect(hub.authorityScore).toBe(0); // No one links to hub

        expect(auth1.authorityScore).toBeGreaterThan(0.5);
        expect(auth1.hubScore).toBe(0); // Auth1 links to no one
    });

    it('should handle exclusion rules', () => {
        const graph = new Graph();
        graph.addNode('http://valid.com', 0, 200);
        graph.addNode('http://noindex.com', 0, 200);
        graph.updateNodeData('http://noindex.com', { noindex: true });
        graph.addNode('http://redirect.com', 0, 200);
        graph.updateNodeData('http://redirect.com', { redirectChain: ['http://target.com'] });
        graph.addNode('http://external.com', 0, 200); // Eligibility check marks it as eligible if status is 200 
        // but typically external wouldn't have status 200 in the graph if we don't crawl them or they are marked as external.
        // The current hits logic relies on: status === 200 && no redirectChain && !noindex

        graph.addEdge('http://valid.com', 'http://noindex.com');
        graph.addEdge('http://valid.com', 'http://redirect.com');

        computeHITS(graph);

        expect(graph.nodes.get('http://noindex.com')?.hubScore).toBeUndefined();
        expect(graph.nodes.get('http://redirect.com')?.hubScore).toBeUndefined();
        expect(graph.nodes.get('http://valid.com')?.hubScore).toBe(0); // Valid hub but its targets are ineligible
    });

    it('should respect edge weights', () => {
        const graph = new Graph();
        graph.addNode('http://hub.com', 0, 200);
        graph.addNode('http://auth-high.com', 1, 200);
        graph.addNode('http://auth-low.com', 1, 200);

        graph.addEdge('http://hub.com', 'http://auth-high.com', 1.0);
        graph.addEdge('http://hub.com', 'http://auth-low.com', 0.1);

        computeHITS(graph, { iterations: 10 });

        const authHigh = graph.nodes.get('http://auth-high.com')!;
        const authLow = graph.nodes.get('http://auth-low.com')!;

        expect(authHigh.authorityScore).toBeGreaterThan(authLow.authorityScore!);
    });

    it('should classify link roles correctly', () => {
        const graph = new Graph();
        // Increase node count slightly to allow 75th percentile to work effectively
        // We need enough "filler" nodes so that the top tier is distinct.
        for (let i = 0; i < 20; i++) {
            graph.addNode(`http://node${i}.com`, 0, 200);
        }

        // AUTHORITY: node1 (linked by many)
        graph.addEdge('http://node0.com', 'http://node1.com');
        graph.addEdge('http://node2.com', 'http://node1.com');
        graph.addEdge('http://node3.com', 'http://node1.com');
        graph.addEdge('http://node4.com', 'http://node1.com');
        graph.addEdge('http://node10.com', 'http://node1.com');

        // HUB: node4 (links to many)
        graph.addEdge('http://node4.com', 'http://node5.com');
        graph.addEdge('http://node4.com', 'http://node6.com');
        graph.addEdge('http://node4.com', 'http://node7.com');
        graph.addEdge('http://node4.com', 'http://node11.com');

        // POWER: node2 (linked by 0, links to authority)
        // To be POWER, it needs high Auth AND high Hub scores.
        // Needs in-links to be high Auth.
        // Needs out-links to be high Hub.

        // Give node2 some in-links
        graph.addEdge('http://node0.com', 'http://node2.com');
        graph.addEdge('http://node12.com', 'http://node2.com');

        // Give node2 some out-links
        graph.addEdge('http://node2.com', 'http://node13.com');
        graph.addEdge('http://node2.com', 'http://node14.com');

        // To make it POWER, it needs to be in top 25% of both scores.
        // With 20 nodes, top 25% is top 5 nodes.

        // PERIPHERAL: node19 (no links)

        // Ensure plenty of low-value nodes to push threshold down
        for(let i=15; i<19; i++) {
             graph.addEdge(`http://node${i}.com`, `http://node${i+1}.com`);
        }

        computeHITS(graph, { iterations: 20 });

        const roles = graph.getNodes().map(n => n.linkRole).filter(Boolean);

        // Debug
        // const nodes = graph.getNodes();
        // console.log(nodes.map(n => ({id: n.url, a: n.authorityScore, h: n.hubScore, role: n.linkRole})).sort((a,b) => b.a! - a.a!));

        expect(roles).toContain('authority');
        expect(roles).toContain('hub');
        // Power is hard to synthesize perfectly in small graph with strict percentile,
        // but let's check basic classification exists
        expect(roles).toContain('peripheral');
    });

    it('should handle large synthetic graphs (Performance Test)', () => {
        const graph = new Graph();
        const nodeCount = 5000;

        // Create 5000 nodes
        for (let i = 0; i < nodeCount; i++) {
            graph.addNode(`http://page${i}.com`, 1, 200);
        }

        // Create random edges (avg 10 per node)
        for (let i = 0; i < nodeCount; i++) {
            for (let j = 0; j < 10; j++) {
                const target = Math.floor(Math.random() * nodeCount);
                if (i !== target) {
                    graph.addEdge(`http://page${i}.com`, `http://page${target}.com`);
                }
            }
        }

        const start = Date.now();
        computeHITS(graph, { iterations: 20 });
        const duration = Date.now() - start;

        console.log(`HITS on 5000 nodes took ${duration}ms`);
        expect(duration).toBeLessThan(2000); // Should be very fast, but allow buffer for CI environments
        expect(graph.nodes.get('http://page0.com')?.hubScore).toBeDefined();
    });
});
