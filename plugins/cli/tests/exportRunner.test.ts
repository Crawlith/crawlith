import { describe, expect, test, vi, beforeEach } from 'vitest';
import { runSitegraphExports } from '../src/utils/exportRunner.js';
import fs from 'node:fs/promises';
import path from 'node:path';

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

    test('visualize export generates sitegraph.html using generateHtml logic', async () => {
        const mockGraphData = {
            nodes: [{ url: 'http://example.com', html: '<div>content</div>' }],
            edges: []
        };
        const mockMetrics = { totalPages: 1 };
        const outputDir = '/tmp/output';

        await runSitegraphExports(['visualize'], outputDir, 'http://example.com', mockGraphData, mockMetrics, {});

        expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });

        // Find the call for sitegraph.html
        const writeFileMock = fs.writeFile as any;
        const calls = writeFileMock.mock.calls;
        const sitegraphCall = calls.find((args: any[]) => args[0].endsWith('sitegraph.html'));

        expect(sitegraphCall).toBeDefined();
        const writtenContent = sitegraphCall[1];

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

        await runSitegraphExports(['html'], outputDir, 'http://example.com', mockGraphData, mockMetrics, {});

        const writeFileMock = fs.writeFile as any;
        const calls = writeFileMock.mock.calls;
        const graphHtmlCall = calls.find((args: any[]) => args[0].endsWith('graph.html'));

        expect(graphHtmlCall).toBeDefined();
        const writtenContent = graphHtmlCall[1];

        expect(writtenContent).toContain('window.GRAPH_DATA =');
        expect(writtenContent).not.toContain('<div>content</div>');
    });
});
