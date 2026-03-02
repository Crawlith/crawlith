import { describe, expect, test, vi, beforeEach } from 'vitest';
import { runCrawlExports, runAnalysisExports } from '../src/utils/exportRunner.js';
import fs from 'node:fs/promises';

vi.mock('@crawlith/core', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as any),
        renderAnalysisHtml: vi.fn(() => '<html>mock html</html>'),
        renderAnalysisMarkdown: vi.fn(() => '# mock markdown'),
        renderAnalysisCsv: vi.fn(() => 'mock,csv'),
    };
});

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

describe('runAnalysisExports', () => {
    const mockAnalysisResult = {
        site_summary: { pages_analyzed: 1, avg_seo_score: 100, thin_pages: 0, duplicate_titles: 0, site_score: 100 },
        site_scores: { seoHealthScore: 100, overallScore: 100, breakdown: {} },
        pages: [],
        active_modules: { seo: true, content: true, accessibility: true }
    } as any;
    const outputDir = '/tmp/analysis-output';

    beforeEach(() => {
        vi.resetAllMocks();
        (fs.mkdir as any).mockResolvedValue(undefined);
        (fs.writeFile as any).mockResolvedValue(undefined);
    });

    test('returns early if no formats provided', async () => {
        await runAnalysisExports([], outputDir, mockAnalysisResult, false);
        expect(fs.mkdir).not.toHaveBeenCalled();
        expect(fs.writeFile).not.toHaveBeenCalled();
    });

    test('json export generates analysis.json', async () => {
        await runAnalysisExports(['json'], outputDir, mockAnalysisResult, false);

        expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });

        const writeFileMock = fs.writeFile as any;
        expect(writeFileMock).toHaveBeenCalledWith(
            expect.stringContaining('analysis.json'),
            JSON.stringify(mockAnalysisResult, null, 2)
        );
    });

    test('html export generates analysis.html if not live', async () => {
        await runAnalysisExports(['html'], outputDir, mockAnalysisResult, false);

        expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });

        const writeFileMock = fs.writeFile as any;
        expect(writeFileMock).toHaveBeenCalledWith(
            expect.stringContaining('analysis.html'),
            '<html>mock html</html>',
            'utf-8'
        );
    });

    test('html export generates page.html if live', async () => {
        await runAnalysisExports(['html'], outputDir, mockAnalysisResult, true);

        expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });

        const writeFileMock = fs.writeFile as any;
        expect(writeFileMock).toHaveBeenCalledWith(
            expect.stringContaining('page.html'),
            '<html>mock html</html>',
            'utf-8'
        );
    });

    test('markdown export generates analysis.md', async () => {
        await runAnalysisExports(['markdown'], outputDir, mockAnalysisResult, false);

        expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });

        const writeFileMock = fs.writeFile as any;
        expect(writeFileMock).toHaveBeenCalledWith(
            expect.stringContaining('analysis.md'),
            '# mock markdown',
            'utf-8'
        );
    });

    test('csv export generates analysis.csv', async () => {
        await runAnalysisExports(['csv'], outputDir, mockAnalysisResult, false);

        expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });

        const writeFileMock = fs.writeFile as any;
        expect(writeFileMock).toHaveBeenCalledWith(
            expect.stringContaining('analysis.csv'),
            'mock,csv',
            'utf-8'
        );
    });
});
