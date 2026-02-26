import { describe, expect, test, vi, beforeEach } from 'vitest';
import { runCrawlExports } from '../src/utils/exportRunner.js';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
    default: {
        mkdir: vi.fn(),
        writeFile: vi.fn(),
    }
}));

describe('exportRunner', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (fs.mkdir as any).mockResolvedValue(undefined);
        (fs.writeFile as any).mockResolvedValue(undefined);
    });

    test('visualize export generates crawl.html using generateHtml logic', async () => {
        const mockGraphData = {
            nodes: [{ url: 'http://example.com', html: '<div>content</div>' }],
            edges: []
        };
        const mockMetrics = { totalPages: 1 };
        const outputDir = '/tmp/output';

        await runCrawlExports(['visualize'], outputDir, 'http://example.com', mockGraphData, mockMetrics, {});

        expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });

        // Find the call for crawl.html
        const writeFileMock = fs.writeFile as any;
        const calls = writeFileMock.mock.calls;
        const crawlCall = calls.find((args: any[]) => args[0].endsWith('crawl.html'));

        expect(crawlCall).toBeDefined();
        const writtenContent = crawlCall[1];

        expect(writtenContent).toContain('window.GRAPH_DATA =');
        expect(writtenContent).not.toContain('<div>content</div>');

        // Extract and parse JSON to be robust against formatting (pretty vs minified)
        const jsonMatch = writtenContent.match(/window\.GRAPH_DATA = (\{[\s\S]*?\});/);
        expect(jsonMatch).not.toBeNull();
        const graphData = JSON.parse(jsonMatch![1]);
        expect(graphData.nodes[0].url).toBe('http://example.com');
    });

    test('html export generates graph.html using generateHtml', async () => {
        const mockGraphData = {
            nodes: [{ url: 'http://example.com', html: '<div>content</div>' }],
            edges: []
        };
        const mockMetrics = { totalPages: 1 };
        const outputDir = '/tmp/output';

        await runCrawlExports(['html'], outputDir, 'http://example.com', mockGraphData, mockMetrics, {});

        const writeFileMock = fs.writeFile as any;
        const calls = writeFileMock.mock.calls;
        const graphHtmlCall = calls.find((args: any[]) => args[0].endsWith('graph.html'));

        expect(graphHtmlCall).toBeDefined();
        const writtenContent = graphHtmlCall[1];

        expect(writtenContent).toContain('window.GRAPH_DATA =');
        expect(writtenContent).not.toContain('<div>content</div>');
    });
});
