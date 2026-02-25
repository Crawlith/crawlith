import { describe, expect, test } from 'vitest';
import { generateHtml } from '../src/report/html.js';
import { Metrics } from '../src/graph/metrics.js';

describe('html report generator', () => {
    test('generates valid html string with metrics', () => {
        const mockMetrics: Metrics = {
            totalPages: 10,
            totalEdges: 20,
            orphanPages: ['https://example.com/orphan'],
            nearOrphans: [],
            deepPages: [],
            topAuthorityPages: [{ url: 'https://example.com/', authority: 0.9 }],
            averageOutDegree: 2.0,
            maxDepthFound: 5,
            crawlEfficiencyScore: 0.8,
            averageDepth: 3.0,
            structuralEntropy: 1.5,
            topPageRankPages: [],
            limitReached: false,
            sessionStats: {
                pagesFetched: 5,
                pagesCached: 2,
                pagesSkipped: 0,
                totalFound: 7
            }
        };

        const mockGraphData = {
            nodes: [
                { url: 'https://example.com/', depth: 0, inLinks: 5, outLinks: 2, status: 200, html: '<body>Content</body>' }
            ],
            edges: []
        };

        const html = generateHtml(mockGraphData, mockMetrics);

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Crawlith Site Graph');

        // Check for injected data
        expect(html).toContain('window.GRAPH_DATA =');
        expect(html).toContain('window.METRICS_DATA =');

        // Verify metrics injection
        expect(html).toContain('"totalPages":10');
        expect(html).toContain('"pagesFetched":5');

        // Verify graph injection and sanitization
        expect(html).toContain('"url":"https://example.com/"');
        expect(html).not.toContain('<body>Content</body>'); // html property should be removed
    });

    test('handles missing session stats', () => {
        const mockMetrics: any = {
            totalPages: 10,
            totalEdges: 20,
            orphanPages: [],
            averageOutDegree: 2.0,
            maxDepthFound: 5,
            topAuthorityPages: [],
            sessionStats: null
        };
        const html = generateHtml({ nodes: [], edges: [] }, mockMetrics as any);
        expect(html).toContain('window.METRICS_DATA =');
        expect(html).toContain('"totalPages":10');
    });
});
