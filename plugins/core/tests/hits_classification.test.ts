import { describe, it, expect } from 'vitest';
import { classifyLinkRoles } from '../src/scoring/hits.js';
import { GraphNode } from '../src/graph/graph.js';

describe('HITS Classification Logic', () => {
    function createNode(id: string, auth: number, hub: number): GraphNode {
        return {
            url: id,
            depth: 0,
            inLinks: 0,
            outLinks: 0,
            status: 200,
            authorityScore: auth,
            hubScore: hub
        } as GraphNode;
    }

    it('should classify nodes based on 75th percentile', () => {
        // Create 10 nodes with linear distribution 0.1 to 1.0
        const nodes: GraphNode[] = [];
        for (let i = 1; i <= 10; i++) {
            nodes.push(createNode(`node${i}`, i / 10, i / 10));
        }

        // Sorted Scores: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        // Length: 10
        // 75th percentile index: floor(10 * 0.75) = 7
        // Threshold Value: nodes[7] -> 0.8

        classifyLinkRoles(nodes);

        // Nodes with score > 0.8 are High.
        // 0.9 (node9) and 1.0 (node10) are High.
        // 0.8 (node8) is NOT > 0.8. So it is Low.

        // Check node 8 (score 0.8) -> Should be balanced (since auth > 0.0001 && hub > 0.0001) but not High
        const node8 = nodes.find(n => n.url === 'node8')!;
        expect(node8.linkRole).toBe('balanced');

        // Check node 9 (score 0.9) -> Should be Power (High Auth & High Hub)
        const node9 = nodes.find(n => n.url === 'node9')!;
        expect(node9.linkRole).toBe('power');

        // Check node 10 (score 1.0) -> Should be Power
        const node10 = nodes.find(n => n.url === 'node10')!;
        expect(node10.linkRole).toBe('power');
    });

    it('should distinguish authority and hub roles', () => {
        // Create a mix of nodes
        const nodes: GraphNode[] = [
            // High Auth, Low Hub
            createNode('auth1', 0.9, 0.1),
            createNode('auth2', 0.95, 0.1),

            // Low Auth, High Hub
            createNode('hub1', 0.1, 0.9),
            createNode('hub2', 0.1, 0.95),

            // Low Both (Filler to lower threshold)
            createNode('fill1', 0.1, 0.1),
            createNode('fill2', 0.1, 0.1),
            createNode('fill3', 0.1, 0.1),
            createNode('fill4', 0.1, 0.1),
        ];

        // Total 8 nodes.
        // 75th index: floor(8 * 0.75) = 6.
        // Auth scores sorted: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.95]
        // Auth Threshold (index 6): 0.9.

        // Hub scores sorted: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.95]
        // Hub Threshold (index 6): 0.9.

        classifyLinkRoles(nodes);

        // Auth1: 0.9. Is 0.9 > 0.9? False. -> Balanced (or peripheral if low enough)
        // Wait, threshold logic is > highAuth.
        // If threshold is 0.9, then 0.9 is NOT high.
        // Auth2: 0.95 > 0.9. True. -> Authority (since Hub 0.1 is not > 0.9).

        expect(nodes.find(n => n.url === 'auth1')?.linkRole).toBe('balanced');
        expect(nodes.find(n => n.url === 'auth2')?.linkRole).toBe('authority');

        expect(nodes.find(n => n.url === 'hub1')?.linkRole).toBe('balanced');
        expect(nodes.find(n => n.url === 'hub2')?.linkRole).toBe('hub');
    });

    it('should demonstrate the difference between median and 75th percentile', () => {
        // Construct a distribution where Median < Score < 75th
        // Median (50th)
        // Target Score
        // 75th

        // [0.1, 0.1, 0.1, 0.5, 0.5, 0.6, 0.9, 0.9]
        // N=8.
        // Median index: 4. Value: 0.5.
        // 75th index: 6. Value: 0.9.

        // Node with 0.6:
        // If Median logic: 0.6 > 0.5 -> High.
        // If 75th logic: 0.6 < 0.9 -> Low.

        const nodes: GraphNode[] = [
            createNode('low1', 0.1, 0.1),
            createNode('low2', 0.1, 0.1),
            createNode('low3', 0.1, 0.1),
            createNode('med1', 0.5, 0.5),
            createNode('med2', 0.5, 0.5),
            createNode('target', 0.6, 0.6),
            createNode('high1', 0.9, 0.9),
            createNode('high2', 0.9, 0.9),
        ];

        classifyLinkRoles(nodes);

        const target = nodes.find(n => n.url === 'target')!;

        // With 75th percentile logic, 0.6 is NOT > 0.9. So it should be balanced.
        // If it was median (0.5), it would be Power.
        expect(target.linkRole).toBe('balanced');
        expect(target.linkRole).not.toBe('power');
    });
});
