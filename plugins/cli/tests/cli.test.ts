import { test, expect, vi, beforeEach } from 'vitest';
import { sitegraph } from '../src/commands/sitegraph.js';
import { analyze } from '../src/commands/analyze.js';
import * as core from '@crawlith/core';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

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
    loadGraphFromSnapshot: vi.fn(),
    LockManager: {
      acquireLock: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn()
    }
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('sitegraph command execution (DB-only, no file writes)', async () => {
  // Mock implementations
  const mockGraph = new core.Graph();
  mockGraph.addNode('https://example.com', 0, 200);

  vi.mocked(core.crawl).mockResolvedValue(123); // returns snapshotId
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
    averageDepth: 0,
    structuralEntropy: 0,
    topPageRankPages: [],
    limitReached: false
  });

  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

  // Run the command — no export flags, so no file writes
  await sitegraph.parseAsync(['https://example.com', '--limit', '10'], { from: 'user' });

  expect(core.crawl).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
    limit: 10
  }));

  expect(core.loadGraphFromSnapshot).toHaveBeenCalledWith(123);
  expect(core.calculateMetrics).toHaveBeenCalled();

  // No file writes in DB-only mode (only lock file from LockManager)
  expect(fs.mkdir).not.toHaveBeenCalled();
  expect(core.generateHtml).not.toHaveBeenCalled();

  // Verify snapshot ID is logged
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('snapshot #123'));

  consoleSpy.mockRestore();
});

test('sitegraph --html flag triggers file export', async () => {
  const mockGraph = new core.Graph();
  mockGraph.addNode('https://example.com', 0, 200);

  vi.mocked(core.crawl).mockResolvedValue(125);
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
    averageDepth: 0,
    structuralEntropy: 0,
    topPageRankPages: [],
    limitReached: false
  });
  vi.mocked(core.generateHtml).mockReturnValue('<html></html>');

  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

  await sitegraph.parseAsync(['https://example.com', '--limit', '10', '--export', 'html', '--output', 'test-output'], { from: 'user' });

  expect(core.generateHtml).toHaveBeenCalled();
  expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('test-output'), { recursive: true });
  expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('graph.html'), '<html></html>');

  consoleSpy.mockRestore();
});

test('sitegraph validates orphan severity flag dependency', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);

  await expect(
    sitegraph.parseAsync(['https://example.com', '--orphan-severity'], { from: 'user' })
  ).rejects.toThrow('exit:1');

  expect(errorSpy).toHaveBeenCalled();
  expect(core.crawl).not.toHaveBeenCalled();

  errorSpy.mockRestore();
  exitSpy.mockRestore();
});


test('sitegraph exits with code 1 when --fail-on-critical is set', async () => {
  const mockGraph = new core.Graph();
  mockGraph.addNode('https://example.com', 0, 200);
  mockGraph.addNode('https://example.com/orphan', 2, 200);

  vi.mocked(core.crawl).mockResolvedValue(124);
  vi.mocked(core.loadGraphFromSnapshot).mockReturnValue(mockGraph);
  vi.mocked(core.calculateMetrics).mockReturnValue({
    totalPages: 2,
    totalEdges: 0,
    orphanPages: ['https://example.com/orphan'],
    nearOrphans: [],
    deepPages: [],
    topAuthorityPages: [],
    averageOutDegree: 0,
    maxDepthFound: 2,
    crawlEfficiencyScore: 1,
    averageDepth: 1,
    structuralEntropy: 0,
    topPageRankPages: [],
    limitReached: false
  });

  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

  await expect(
    sitegraph.parseAsync(['https://example.com', '--fail-on-critical'], { from: 'user' })
  ).rejects.toThrow('exit:1');

  logSpy.mockRestore();
  exitSpy.mockRestore();
});


test('analyze command json and html output', async () => {
  vi.mocked(core.analyzeSite).mockResolvedValue({
    site_summary: { pages_analyzed: 1, avg_seo_score: 80, thin_pages: 0, duplicate_titles: 0, site_score: 82 },
    site_scores: { seoHealthScore: 80, authorityEntropyOrphanScore: 85, overallScore: 82 },
    pages: [],
    active_modules: { seo: false, content: false, accessibility: false }
  });
  vi.mocked(core.renderAnalysisHtml).mockReturnValue('<html>analysis</html>');

  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

  await analyze.parseAsync(['https://example.com', '--from-crawl', 'crawl.json', '--export', 'html'], { from: 'user' });

  expect(core.analyzeSite).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ fromCrawl: 'crawl.json' }));
  expect(core.renderAnalysisHtml).toHaveBeenCalled();
  expect(fs.mkdir).toHaveBeenCalled();
  expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('analysis.html'), '<html>analysis</html>', 'utf-8');

  logSpy.mockRestore();
});

test('analyze exits with code 1 when --fail-on-critical is set', async () => {
  vi.mocked(core.analyzeSite).mockResolvedValue({
    site_summary: { pages_analyzed: 1, avg_seo_score: 60, thin_pages: 1, duplicate_titles: 0, site_score: 58 },
    site_scores: { seoHealthScore: 60, authorityEntropyOrphanScore: 60, overallScore: 58 },
    pages: [{
      url: 'https://example.com',
      status: 200,
      seoScore: 50,
      thinScore: 90,
      title: { value: null, length: 0, status: 'missing' },
      metaDescription: { value: null, length: 0, status: 'missing' },
      h1: { count: 0, status: 'critical', matchesTitle: false },
      content: { wordCount: 10, textHtmlRatio: 0, uniqueSentenceCount: 1 },
      images: { totalImages: 1, missingAlt: 1, emptyAlt: 0 },
      links: { internalLinks: 0, externalLinks: 0, nofollowCount: 0, externalRatio: 0 },
      structuredData: { present: false, valid: false, types: [] },
      meta: { noindex: true }
    }],
    active_modules: { seo: false, content: false, accessibility: false }
  });

  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);

  await expect(
    analyze.parseAsync(['https://example.com', '--from-crawl', 'crawl.json', '--fail-on-critical'], { from: 'user' })
  ).rejects.toThrow('exit:1');

  exitSpy.mockRestore();
});

test('sitegraph diff execution via --compare', async () => {
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

  await sitegraph.parseAsync(['--compare', 'old.json', 'new.json'], { from: 'user' });

  expect(fs.readFile).toHaveBeenCalledTimes(2);
  expect(core.compareGraphs).toHaveBeenCalled();
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Metric Deltas'));

  consoleSpy.mockRestore();
  errorSpy.mockRestore();
});
