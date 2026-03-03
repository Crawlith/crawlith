import { describe, it, expect } from 'vitest';
import { Crawl_HTML } from '../src/report/crawl_template.js';



describe('Visualization Data & Template', () => {


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
