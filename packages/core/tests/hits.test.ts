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

        computeHITS(graph, { iterations: 20 });

        const roles = graph.getNodes().map(n => n.linkRole).filter(Boolean);
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
        computeHITS(graph, { iterations: 20 });
        const duration = Date.now() - start;

        console.log(`HITS on 5000 nodes took ${duration}ms`);
        expect(duration).toBeLessThan(2000); // Should be very fast, but allow buffer for CI environments
        expect(graph.nodes.get('http://page0.com')?.hubScore).toBeDefined();
    });
});

    it('should handle zero eligible nodes safely', () => {
        const graph = new Graph();
        graph.addNode('http://broken.com', 1, 404);

        computeHITS(graph);
        expect(graph.nodes.get('http://broken.com')!.hubScore).toBeUndefined();
    });

    it('should handle nodes with no edges', () => {
        const graph = new Graph();
        graph.addNode('http://isolated1.com', 0, 200);
        graph.addNode('http://isolated2.com', 0, 200);

        computeHITS(graph);

        expect(graph.nodes.get('http://isolated1.com')!.hubScore).toBe(0);
        expect(graph.nodes.get('http://isolated2.com')!.authorityScore).toBe(0);
    });

    it('should use default iterations if not provided', () => {
        const graph = new Graph();
        graph.addNode('http://hub.com', 0, 200);
        graph.addNode('http://auth.com', 1, 200);
        graph.addEdge('http://hub.com', 'http://auth.com');

        computeHITS(graph);

        const hub = graph.nodes.get('http://hub.com')!;
        expect(hub.hubScore).toBeGreaterThan(0);
    });

    it('should classify link roles correctly (power, balanced)', () => {
        const graph = new Graph();

        const size = 10;

        for(let i=0; i<size; i++) {
           graph.addNode(`http://high-auth-${i}.com`, 0, 200);
           graph.addNode(`http://high-hub-${i}.com`, 0, 200);
           for(let j=0; j<size; j++) {
              graph.addEdge(`http://high-hub-${i}.com`, `http://high-auth-${j}.com`);
           }
        }

        graph.addNode('http://balanced.com', 0, 200);
        graph.addEdge('http://high-hub-0.com', 'http://balanced.com');
        graph.addEdge('http://balanced.com', 'http://high-auth-0.com');

        for(let i=0; i<size*2; i++) {
            graph.addNode(`http://low-${i}.com`, 0, 200);
            graph.addEdge(`http://low-${i}.com`, 'http://high-auth-0.com');
            graph.addEdge('http://high-hub-0.com', `http://low-${i}.com`);
        }

        computeHITS(graph);

        const balancedRoles = Array.from(graph.nodes.values()).filter(n => n.linkRole === 'balanced');
        expect(balancedRoles.length).toBeGreaterThan(0);
    });

    it('should classify link roles correctly (power)', () => {
        const graph = new Graph();

        graph.addNode('http://a.com', 0, 200);
        graph.addNode('http://b.com', 0, 200);
        graph.addNode('http://c.com', 0, 200);

        graph.addEdge('http://a.com', 'http://b.com');
        graph.addEdge('http://b.com', 'http://c.com');
        graph.addEdge('http://c.com', 'http://a.com');

        computeHITS(graph);

        const powerRoles = Array.from(graph.nodes.values()).filter(n => n.linkRole === 'power');
        expect(powerRoles.length).toBeGreaterThan(0);
    });

    it('should ignore self-links', () => {
        const graph = new Graph();
        graph.addNode('http://self.com', 0, 200);
        graph.addEdge('http://self.com', 'http://self.com');

        computeHITS(graph);

        const node = graph.nodes.get('http://self.com')!;
        expect(node.authorityScore).toBe(0);
        expect(node.hubScore).toBe(0);
    });

    it('should ignore edges linking to unrecorded/unindexed nodes', () => {
        const graph = new Graph();
        graph.addNode('http://valid.com', 0, 200);
        graph.addEdge('http://valid.com', 'http://unknown.com');

        computeHITS(graph);

        const node = graph.nodes.get('http://valid.com')!;
        expect(node.hubScore).toBe(0);
    });

    it('assignLinksRole with empty node list', () => {
        const graph = new Graph();
        computeHITS(graph);
        expect(graph.nodes.size).toBe(0);
    });
