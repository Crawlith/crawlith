import { test, expect, vi, beforeEach } from 'vitest';
import { crawlCommand } from '../src/commands/crawl.js';
import { analyze } from '../src/commands/page.js';
import * as core from '@crawlith/core';
import fs from 'node:fs/promises';
import { resolveCommandPlugins } from '../src/plugins.js';

vi.mock('node:fs/promises');
vi.mock('../src/plugins.js', () => ({
  resolveCommandPlugins: vi.fn().mockReturnValue([]),
  registerPluginFlags: vi.fn((command) => {
    // Add flags needed for tests to avoid "unknown option" errors
    command.option('--export <formats>', 'Export formats');
    command.option('--output <path>', 'Output path');
    command.option('--format <type>', 'Format type');
    command.option('--orphan-severity', 'Orphan severity');
    command.option('--compare <files...>', 'Compare snapshots');
  }),
}));

vi.mock('@crawlith/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@crawlith/core')>();
  return {
    ...actual,
    crawl: vi.fn(),
    calculateMetrics: vi.fn(),
    generateHtml: vi.fn(),
    compareGraphs: vi.fn(),
    analyzeSite: vi.fn(),
    renderAnalysisHtml: vi.fn(),
    runPostCrawlMetrics: vi.fn(),
    runCrawlExports: vi.fn(),
    runAnalysisExports: vi.fn(),
    parseExportFormats: actual.parseExportFormats,
    loadGraphFromSnapshot: vi.fn(),
    LockManager: {
      acquireLock: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn()
    },
    CrawlSitegraph: class {
      async execute(input: any) {
        const id = await (core.crawl as any)(input.url, input, input.context);
        const graph = (core.loadGraphFromSnapshot as any)(id);
        return { snapshotId: id, graph };
      }
    },
    PageAnalysisUseCase: class {
      async execute(input: any) {
        return (core.analyzeSite as any)(input.url, input, undefined);
      }
    }
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('crawl command execution (DB-only, no file writes)', async () => {
  const mockGraph = new core.Graph();
  mockGraph.addNode('https://example.com', 0, 200);

  vi.mocked(core.crawl).mockResolvedValue(123);
  vi.mocked(core.loadGraphFromSnapshot).mockReturnValue(mockGraph);
  vi.mocked(core.calculateMetrics).mockReturnValue({
    totalPages: 1,
    totalEdges: 0,
    orphanPages: [],
    nearOrphans: [],
    deepPages: [],
    topAuthorityPages: [],
    averageOutDegree: 0,
    maxDepthFound: 0,
    crawlEfficiencyScore: 0,
    averageDepth: 0
  } as any);

  await crawlCommand.parseAsync(['node', 'crawl', 'https://example.com']);

  expect(core.crawl).toHaveBeenCalled();
});

test('crawl command with exports', async () => {
  const mockGraph = new core.Graph();
  mockGraph.addNode('https://example.com', 0, 200);

  vi.mocked(core.crawl).mockResolvedValue(456);
  vi.mocked(core.loadGraphFromSnapshot).mockReturnValue(mockGraph);
  vi.mocked(core.calculateMetrics).mockReturnValue({
    totalPages: 1,
    totalEdges: 0,
    orphanPages: [],
    nearOrphans: [],
    deepPages: [],
    topAuthorityPages: [],
    averageOutDegree: 0,
    maxDepthFound: 0,
    crawlEfficiencyScore: 1,
    averageDepth: 1
  } as any);

  vi.mocked(core.generateHtml).mockReturnValue('<html></html>');
  vi.mocked(resolveCommandPlugins).mockReturnValue([{
    name: 'ExporterPlugin',
    onAfterCrawl: async () => { await core.runCrawlExports([], '', '', {}, {}, {}); }
  } as any]);

  await crawlCommand.parseAsync(['node', 'crawl', 'https://example.com', '--export', 'html', '--output', 'test-output']);

  expect(core.crawl).toHaveBeenCalled();
  expect(core.runCrawlExports).toHaveBeenCalled();
});

test('crawl validates orphan severity flag dependency', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
  // We don't want to throw for process.exit(1) here because commander will call it when we fail validation
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit:1') }) as any);

  await expect(
    crawlCommand.parseAsync(['node', 'crawl', 'https://example.com', '--orphan-severity'])
  ).rejects.toThrow('exit:1');

  errorSpy.mockRestore();
  exitSpy.mockRestore();
});

test('analyze command json and html output', async () => {
  const mockResult = {
    url: 'https://example.com',
    pages: [{ url: 'https://example.com', status: 200, seoScore: 90, thinScore: 0, title: { status: 'ok' }, metaDescription: { status: 'ok' }, meta: {} }],
    site_summary: { pages_analyzed: 1, site_score: 90, avg_seo_score: 90, thin_pages: 0, duplicate_titles: 0 },
    active_modules: { seo: true, content: true, accessibility: true }
  };

  vi.mocked(core.analyzeSite).mockResolvedValue(mockResult as any);
  vi.mocked(resolveCommandPlugins).mockReturnValue([{
    name: 'ExporterPlugin',
    onAnalyzeDone: async () => { await core.runAnalysisExports([], '', {}, true); }
  } as any]);

  await analyze.parseAsync(['https://example.com', '--export', 'html'], { from: 'user' });

  expect(core.analyzeSite).toHaveBeenCalled();
  expect(core.runAnalysisExports).toHaveBeenCalled();
});

test('crawl diff execution via --compare', async () => {
  const oldGraph = { nodes: [{ url: 'http://a.com', depth: 0, status: 200, inLinks: 0, outLinks: 0 }], edges: [] };
  const newGraph = { nodes: [{ url: 'http://a.com', depth: 0, status: 200, inLinks: 0, outLinks: 0 }], edges: [] };

  vi.mocked(fs.readFile)
    .mockResolvedValueOnce(JSON.stringify(oldGraph))
    .mockResolvedValueOnce(JSON.stringify(newGraph));

  vi.mocked(core.compareGraphs).mockReturnValue({
    addedUrls: [], removedUrls: [], changedStatus: [], changedCanonical: [], changedDuplicateGroup: [],
    metricDeltas: { structuralEntropy: 0, orphanCount: 0, crawlEfficiency: 0 }
  });

  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

  await crawlCommand.parseAsync(['node', 'crawl', 'https://example.com', '--compare', 'old.json', 'new.json']);

  expect(fs.readFile).toHaveBeenCalledTimes(2);
  expect(core.compareGraphs).toHaveBeenCalled();
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Metric Deltas'));

  consoleSpy.mockRestore();
  errorSpy.mockRestore();
});
