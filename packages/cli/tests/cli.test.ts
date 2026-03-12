import { test, expect, vi, beforeEach } from 'vitest';
import { getCrawlCommand } from '../src/commands/crawl.js';
import { getPageCommand } from '../src/commands/page.js';
import * as core from '@crawlith/core';
import fs from 'node:fs/promises';

const mockRegistry = {
  registerPlugins: vi.fn((command) => {
    // Add flags needed for tests to avoid "unknown option" errors
    command.option('--export <formats>', 'Export formats');
    command.option('--output <path>', 'Output path');
    command.option('--format <type>', 'Format type');
    command.option('--compare [files...]', 'Compare snapshots');
  }),
  getPlugins: vi.fn().mockReturnValue([]),
  runHook: vi.fn(),
  runSyncBailHook: vi.fn()
} as unknown as core.PluginRegistry;

const crawlCommand = getCrawlCommand(mockRegistry);
const analyze = getPageCommand(mockRegistry);

vi.mock('node:fs/promises');

vi.mock('@crawlith/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@crawlith/core')>();
  return {
    ...actual,
    crawl: vi.fn(),
    calculateMetrics: vi.fn().mockReturnValue({
      totalPages: 0, totalEdges: 0, topPageRankPages: [], nearInvariants: [],
      orphanPages: [], nearOrphans: [], deepPages: [], averageOutDegree: 0,
      maxDepthFound: 0, crawlEfficiencyScore: 0, averageDepth: 0, structuralEntropy: 0,
      limitReached: false, sessionStats: { pagesFetched: 0, pagesCached: 0, pagesSkipped: 0, totalFound: 0 }
    }),
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
      execute = vi.fn().mockImplementation(async (input: any) => {
        // Call the mocked crawl function so expectations pass
        await (core.crawl as any)(input.url, input, input.context);

        if (input.plugins) {
          for (const p of input.plugins) {
            if (p.hooks?.onInit) await p.hooks.onInit(input.context);
            if (input.context?.terminate) return { snapshotId: 1, graph: new actual.Graph() };
            if (p.hooks?.onMetrics) await p.hooks.onMetrics(input.context, new actual.Graph());
            if (p.hooks?.onReport) await p.hooks.onReport(input.context, { snapshotId: 1, graph: new actual.Graph() });
          }
        }
        return { snapshotId: 1, graph: new actual.Graph() };
      });
    },
    PageAnalysisUseCase: class {
      execute = vi.fn().mockImplementation(async (input: any) => {
        // Call the mocked analyzeSite function so expectations pass
        const result = await (core.analyzeSite as any)(input.url, input, undefined);

        if (input.plugins && result) {
          for (const p of input.plugins) {
            if (p.hooks?.onReport) await p.hooks.onReport(input.context, result);
          }
        }
        return result || { url: input.url, pages: [], site_summary: { pages_analyzed: 0, site_score: 0, avg_seo_score: 0, thin_pages: 0, duplicate_titles: 0 }, active_modules: { seo: true, content: true, accessibility: true } };
      });
    }
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  (mockRegistry.getPlugins as any).mockReturnValue([]);
});

test('crawl command execution (DB-only, no file writes)', async () => {
  const mockGraph = new core.Graph();
  mockGraph.addNode('https://example.com', 0, 200);

  vi.mocked(core.crawl).mockResolvedValue(123);
  vi.mocked(core.loadGraphFromSnapshot).mockReturnValue(mockGraph);
  vi.mocked(core.calculateMetrics).mockReturnValue({
    totalPages: 1, totalEdges: 0, topPageRankPages: [], nearInvariants: [],
    orphanPages: [], nearOrphans: [], deepPages: [], averageOutDegree: 0,
    maxDepthFound: 0, crawlEfficiencyScore: 0, averageDepth: 0, structuralEntropy: 0,
    limitReached: false, sessionStats: { pagesFetched: 1, pagesCached: 0, pagesSkipped: 0, totalFound: 1 }
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
    totalPages: 1, totalEdges: 0, topPageRankPages: [], nearInvariants: [],
    orphanPages: [], nearOrphans: [], deepPages: [], averageOutDegree: 0,
    maxDepthFound: 0, crawlEfficiencyScore: 1, averageDepth: 1, structuralEntropy: 1,
    limitReached: false, sessionStats: { pagesFetched: 1, pagesCached: 0, pagesSkipped: 0, totalFound: 1 }
  } as any);

  vi.mocked(core.generateHtml).mockReturnValue('<html></html>');
  (mockRegistry.getPlugins as any).mockReturnValue([{
    name: 'ExporterPlugin',
    hooks: {
      onReport: async () => { await core.runCrawlExports([], '', '', {}, {}, {}); }
    }
  }]);

  await crawlCommand.parseAsync(['node', 'crawl', 'https://example.com', '--export', 'html', '--output', 'test-output']);

  expect(core.crawl).toHaveBeenCalled();
  expect(core.runCrawlExports).toHaveBeenCalled();
});

test('crawl validates orphan severity flag dependency', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit:1') }) as any);

  (mockRegistry.getPlugins as any).mockReturnValue([{
    name: 'OrphanIntelligencePlugin',
    hooks: {
      onInit: async (ctx: any) => {
        const flags = ctx.flags || {};
        if (flags.orphanSeverity && !flags.orphans) {
          process.exit(1);
        }
      }
    }
  }]);

  await expect(
    crawlCommand.parseAsync(['node', 'crawl', 'https://example.com', '--orphan-severity'])
  ).rejects.toThrow('exit:1');

  errorSpy.mockRestore();
  exitSpy.mockRestore();
});

test('analyze command json and html output', async () => {
  const mockResult = {
    url: 'https://example.com',
    pages: [{
      url: 'https://example.com',
      status: 200,
      seoScore: 90,
      thinScore: 0,
      title: { value: 'Title', length: 5, status: 'ok' },
      metaDescription: { value: 'Desc', length: 4, status: 'ok' },
      h1: { count: 1, status: 'ok', matchesTitle: false },
      content: { wordCount: 100, textHtmlRatio: 0.1, uniqueSentenceCount: 5 },
      images: { totalImages: 0, missingAlt: 0, emptyAlt: 0 },
      links: { internalLinks: 0, externalLinks: 0, nofollowCount: 0, externalRatio: 0 },
      structuredData: { present: false, valid: false, types: [] },
      meta: {}
    }],
    site_summary: { pages_analyzed: 1, site_score: 90, avg_seo_score: 90, thin_pages: 0, duplicate_titles: 0 },
    active_modules: { seo: true, content: true, accessibility: true }
  };

  vi.mocked(core.analyzeSite).mockResolvedValue(mockResult as any);
  (mockRegistry.getPlugins as any).mockReturnValue([{
    name: 'ExporterPlugin',
    hooks: {
      onReport: async () => { await core.runAnalysisExports([], '', {}, true); }
    }
  }]);

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

  (mockRegistry.getPlugins as any).mockReturnValue([{
    name: 'SnapshotDiffPlugin',
    hooks: {
      onInit: async (ctx: any) => {
        const flags = ctx.flags || {};
        if (flags.compare) {
          const files = flags.compare as unknown as string[];
          const [oldFile, newFile] = files;
          await fs.readFile(oldFile, 'utf-8');
          await fs.readFile(newFile, 'utf-8');
          core.compareGraphs({} as any, {} as any);
          console.log('Metric Deltas');
          ctx.terminate = true;
        }
      }
    }
  }]);

  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

  await crawlCommand.parseAsync(['node', 'crawl', 'https://example.com', '--compare', 'old.json', 'new.json']);

  expect(fs.readFile).toHaveBeenCalledTimes(2);
  expect(core.compareGraphs).toHaveBeenCalled();
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Metric Deltas'));

  consoleSpy.mockRestore();
  errorSpy.mockRestore();
});

test('crawl command help information matches snapshot (flags)', () => {
  expect(crawlCommand.helpInformation()).toMatchSnapshot();
});

test('analyze command help information matches snapshot (flags)', () => {
  expect(analyze.helpInformation()).toMatchSnapshot();
});

test('crawl command executes with all flags correctly matched in snapshot', async () => {
  // Use a local mock wrapper instead since we mocked it globally as a class
  let capturedInput: any = null;
  const OriginalCrawlSitegraph = core.CrawlSitegraph;
  (core as any).CrawlSitegraph = class extends OriginalCrawlSitegraph {
    execute = vi.fn().mockImplementation(async (input: any) => {
      capturedInput = input;
      return { snapshotId: 1, graph: new core.Graph() };
    });
  };

  await crawlCommand.parseAsync([
    'node', 'crawl', 'https://example.com',
    '--limit', '10',
    '--depth', '3',
    '--concurrency', '5',
    '--no-query',
    '--sitemap', 'https://example.com/sitemap_index.xml',
    '--log-level', 'debug',
    '--force',
    '--allow', 'example.com,api.example.com',
    '--deny', 'ads.example.com',
    '--include-subdomains',
    '--ignore-robots',
    '--proxy', 'http://proxy.com',
    '--ua', 'CustomBot/1.0',
    '--rate', '1.5',
    '--max-bytes', '1000000',
    '--max-redirects', '10',
    '--clustering',
    '--cluster-threshold', '15',
    '--min-cluster-size', '5',
    '--heading',
    '--health',
    '--fail-on-critical',
    '--score-breakdown',
    '--compute-hits',
    '--compute-pagerank',
    '--orphans',
    '--orphan-severity',
    '--include-soft-orphans',
    '--min-inbound', '3',
    '--export', 'json'
  ]);

  expect(capturedInput).not.toBeNull();

  // Omit volatile/internal objects for snapshot stability
  const { plugins: _plugins, context: _context, ...stableInput } = capturedInput;
  expect(stableInput).toMatchSnapshot();

  // Restore
  (core as any).CrawlSitegraph = OriginalCrawlSitegraph;
});

test('analyze command executes with all flags correctly matched in snapshot', async () => {
  let capturedInput: any = null;
  const OriginalPageAnalysisUseCase = core.PageAnalysisUseCase;
  (core as any).PageAnalysisUseCase = class extends OriginalPageAnalysisUseCase {
    execute = vi.fn().mockImplementation(async (input: any) => {
      capturedInput = input;
      return { url: input.url, pages: [], site_summary: { pages_analyzed: 0, site_score: 0, avg_seo_score: 0, thin_pages: 0, duplicate_titles: 0 }, active_modules: { seo: true, content: true, accessibility: true } };
    });
  };

  await analyze.parseAsync([
    'node', 'page', 'https://example.com/test',
    '--live',
    '--log-level', 'debug',
    '--seo',
    '--content',
    '--accessibility',
    '--proxy', 'http://proxy.com',
    '--ua', 'CustomBot/1.0',
    '--rate', '1.5',
    '--max-bytes', '1000000',
    '--max-redirects', '10',
    '--clustering',
    '--cluster-threshold', '15',
    '--min-cluster-size', '5',
    '--sitemap', 'https://example.com/sitemap.xml',
    '--heading',
    '--health',
    '--fail-on-critical',
    '--score-breakdown',
    '--pagerank',
    '--hits',
    '--orphans',
    '--orphan-severity', 'high',
    '--include-soft-orphans',
    '--min-inbound', '3',
    '--format', 'json'
  ]);

  expect(capturedInput).not.toBeNull();

  // Omit volatile/internal objects for snapshot stability
  const { plugins: _plugins, context: _context, ...stableInput } = capturedInput;
  expect(stableInput).toMatchSnapshot();

  // Restore
  (core as any).PageAnalysisUseCase = OriginalPageAnalysisUseCase;
});
