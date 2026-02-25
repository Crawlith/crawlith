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
            nodes: [{ url: 'https://example.com/', depth: 0, inLinks: 5, outLinks: 2, status: 200 }],
            edges: []
        };

        const html = generateHtml(mockGraphData, mockMetrics);

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Crawlith Site Graph');
        expect(html).toContain('10</span>'); // totalPages
        expect(html).toContain('5 pages</span>'); // pagesFetched
        expect(html).toContain('2</span>'); // pagesCached
        expect(html).toContain('https://example.com/orphan');
        expect(html).toContain('window.GRAPH_DATA =');
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
        expect(html).not.toContain('Session Crawl:');
    });
});
