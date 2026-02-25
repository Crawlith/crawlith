import { describe, expect, test, vi, beforeEach } from 'vitest';
import { runSitegraphExports } from '../src/utils/exportRunner.js';
import fs from 'node:fs/promises';

// Mock fs and path
vi.mock('node:fs/promises');

describe('runSitegraphExports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('generates visualize report correctly', async () => {
        const mockGraphData = {
            nodes: [
                { url: 'https://example.com/', depth: 0, inLinks: 5, outLinks: 2, status: 200, html: '<body>Big content</body>' }
            ],
            edges: []
        };
        const mockMetrics = {
            totalPages: 10,
            totalEdges: 20,
            orphanPages: [],
            sessionStats: {
                pagesFetched: 5,
                pagesCached: 2,
                pagesSkipped: 0,
                totalFound: 7
            }
        };

        const outputDir = '/tmp/reports';
        const url = 'https://example.com';

        await runSitegraphExports(
            ['visualize'],
            outputDir,
            url,
            mockGraphData,
            mockMetrics,
            {} // graphObj mock
        );

        expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });

        const writeFileCalls = (fs.writeFile as any).mock.calls;
        const visualizeCall = writeFileCalls.find((call: any[]) => call[0].endsWith('sitegraph.html'));

        expect(visualizeCall).toBeDefined();
        const content = visualizeCall[1];

        // Check for injected data
        expect(content).toContain('window.GRAPH_DATA =');
        expect(content).toContain('window.METRICS_DATA =');

        // Verify metrics injection
        // Handles both minified (generateHtml) and pretty-printed (current visualize)
        expect(content).toMatch(/"totalPages":\s*10/);

        // Verify graph injection
        expect(content).toMatch(/"url":\s*"https:\/\/example\.com\/"/);

        // Verify HTML property removed (if using generateHtml or current implementation)
        // Current implementation:
        // const { html: _unusedHtml, ...rest } = n;
        expect(content).not.toContain('Big content');
    });

    test('generates html report correctly', async () => {
        const mockGraphData = {
             nodes: [],
             edges: []
        };
        const mockMetrics = {};
        const outputDir = '/tmp/reports';
        const url = 'https://example.com';

        await runSitegraphExports(
            ['html'],
            outputDir,
            url,
            mockGraphData,
            mockMetrics,
            {}
        );

        const writeFileCalls = (fs.writeFile as any).mock.calls;
        const htmlCall = writeFileCalls.find((call: any[]) => call[0].endsWith('graph.html'));
        expect(htmlCall).toBeDefined();
    });
});
