import { describe, it, expect } from 'vitest';
import { Graph } from '@crawlith/core';
import { HITSService } from '../src/Service.js';

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

        const service = new HITSService();
        const results = service.evaluate(graph, { iterations: 10 });
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).authorityScore = res.authority_score;
            (node as any).hubScore = res.hub_score;
            (node as any).linkRole = res.link_role;
        }

        const hub = graph.nodes.get('http://hub.com')!;
        const auth1 = graph.nodes.get('http://auth1.com')!;

        // In a star topology:
        // Hub should have max hub score
        // Authorities should have max authority scores
        expect((hub as any).hubScore).toBeGreaterThan(0.9);
        expect((hub as any).authorityScore).toBe(0); // No one links to hub

        expect((auth1 as any).authorityScore).toBeGreaterThan(0.5);
        expect((auth1 as any).hubScore).toBe(0); // Auth1 links to no one
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

        const service = new HITSService();
        const results = service.evaluate(graph);
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).authorityScore = res.authority_score;
            (node as any).hubScore = res.hub_score;
            (node as any).linkRole = res.link_role;
        }

        expect((graph.nodes.get('http://noindex.com') as any)?.hubScore).toBeUndefined();
        expect((graph.nodes.get('http://redirect.com') as any)?.hubScore).toBeUndefined();
        expect((graph.nodes.get('http://valid.com') as any)?.hubScore).toBe(0); // Valid hub but its targets are ineligible
    });

    it('should respect edge weights', () => {
        const graph = new Graph();
        graph.addNode('http://hub.com', 0, 200);
        graph.addNode('http://auth-high.com', 1, 200);
        graph.addNode('http://auth-low.com', 1, 200);

        graph.addEdge('http://hub.com', 'http://auth-high.com', 1.0);
        graph.addEdge('http://hub.com', 'http://auth-low.com', 0.1);

        const service = new HITSService();
        const results = service.evaluate(graph, { iterations: 10 });
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).authorityScore = res.authority_score;
            (node as any).hubScore = res.hub_score;
            (node as any).linkRole = res.link_role;
        }

        const authHigh = graph.nodes.get('http://auth-high.com')!;
        const authLow = graph.nodes.get('http://auth-low.com')!;

        expect((authHigh as any).authorityScore).toBeGreaterThan((authLow as any).authorityScore!);
    });

    it('should classify link roles correctly', () => {
        const graph = new Graph();
        for (let i = 0; i < 11; i++) {
            graph.addNode(`http://node${i}.com`, 0, 200);
        }

        // AUTHORITY: node1 (linked by 0,2,3... no outlinks)
        graph.addEdge('http://node0.com', 'http://node1.com');
        graph.addEdge('http://node2.com', 'http://node1.com');
        graph.addEdge('http://node3.com', 'http://node1.com');
        graph.addEdge('http://node4.com', 'http://node1.com');

        // HUB: node4 (links to 1,5,6,7... few inlinks)
        graph.addEdge('http://node4.com', 'http://node5.com');
        graph.addEdge('http://node4.com', 'http://node6.com');
        graph.addEdge('http://node4.com', 'http://node7.com');

        // POWER: node2 (linked by 0, power is often recursive... link to authority and be linked by hub)
        graph.addEdge('http://node0.com', 'http://node2.com');
        graph.addEdge('http://node2.com', 'http://node1.com');
        graph.addEdge('http://node2.com', 'http://node5.com');

        // PERIPHERAL: node10 (no links)
        // Some filler nodes to push medians down
        graph.addEdge('http://node8.com', 'http://node9.com');

        const service = new HITSService();
        const results = service.evaluate(graph, { iterations: 20 });
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).authorityScore = res.authority_score;
            (node as any).hubScore = res.hub_score;
            (node as any).linkRole = res.link_role;
        }

        const roles = graph.getNodes().map(n => (n as any).linkRole).filter(Boolean);
        expect(roles).toContain('authority');
        expect(roles).toContain('hub');
        expect(roles).toContain('power');
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
        const service = new HITSService();
        const results = service.evaluate(graph, { iterations: 20 });
        for (const [url, res] of results) {
            const node = graph.nodes.get(url)!;
            (node as any).authorityScore = res.authority_score;
            (node as any).hubScore = res.hub_score;
            (node as any).linkRole = res.link_role;
        }
        const duration = Date.now() - start;

        console.log(`HITS on 5000 nodes took ${duration}ms`);
        expect(duration).toBeLessThan(2000); // Should be very fast, but allow buffer for CI environments
        expect((graph.nodes.get('http://page0.com') as any)?.hubScore).toBeDefined();
    });
});
