import { describe, it, expect } from 'vitest';
import { Crawl_HTML } from '../src/report/crawl_template.js';
import { Graph } from '../src/graph/graph.js';
import { computePageRank } from '../src/graph/pagerank.js';

describe('Visualization Data & Template', () => {
    it('should include pageRankScore in graph JSON output after PageRank computation', () => {
        const graph = new Graph();
        graph.addNode('https://a.com', 0, 200);
        graph.addNode('https://b.com', 1, 200);
        graph.addEdge('https://a.com', 'https://b.com');

        computePageRank(graph);

        const json = graph.toJSON();
        const nodeA = json.nodes.find(n => n.url === 'https://a.com');
        const nodeB = json.nodes.find(n => n.url === 'https://b.com');

        expect(nodeA).toBeDefined();
        expect(nodeB).toBeDefined();
        expect(typeof nodeA?.pageRankScore).toBe('number');
        expect(typeof nodeB?.pageRankScore).toBe('number');
    });

    it('should contain UI toggle buttons for Authority Mode', () => {
        expect(Crawl_HTML).toContain('id="btn-auth-pagerank"');
        expect(Crawl_HTML).toContain('id="btn-auth-structural"');
    });

    it('should contain setAuthorityMode function', () => {
        // Use regex to be flexible with whitespace
        expect(Crawl_HTML).toMatch(/function\s+setAuthorityMode\s*\(mode,\s*btn\)/);
        expect(Crawl_HTML).toContain('n.authority = mode === \'pagerank\' ? n.pageRankAuthority : n.structuralAuthority');
    });

    it('should contain logic to calculate pageRankAuthority from pageRankScore', () => {
        expect(Crawl_HTML).toContain('n.pageRankAuthority = n.pageRankScore / 100');
        expect(Crawl_HTML).toContain('n.structuralAuthority = Math.log(1 + n.inLinks)');
    });

    it('should update details panel to show both metrics', () => {
        expect(Crawl_HTML).toContain('id="d-auth-container"');
        expect(Crawl_HTML).toContain('In-Degree: ${structVal}');
        expect(Crawl_HTML).toContain('PR: <strong>${prVal}</strong>');
    });
});
