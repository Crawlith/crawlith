import { describe, expect, test } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { analyzeSite, renderAnalysisHtml } from '../src/analysis/analyze.js';

describe('analyze integration', () => {
  const fixturePath = path.resolve(import.meta.dirname, 'fixtures/analyze-crawl.json');

  test('analyzes full crawl fixture and schema', async () => {
    const result = await analyzeSite('https://example.com', { fromCrawl: fixturePath });

    expect(result.site_summary.pages_analyzed).toBe(3);
    expect(result.site_summary.duplicate_titles).toBe(2);
    expect(result.site_summary.avg_seo_score).toBeGreaterThanOrEqual(0);
    expect(result.pages[0]).toHaveProperty('title');
    expect(result.pages[0]).toHaveProperty('content');
    expect(result.pages[0]).toHaveProperty('links');
    expect(result.site_scores.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.site_scores.overallScore).toBeLessThanOrEqual(100);
  });

  test('module filter flags behavior', async () => {
    const seoOnly = await analyzeSite('https://example.com', { fromCrawl: fixturePath, seo: true });
    expect(seoOnly.pages[0].content.wordCount).toBe(0);
    expect(seoOnly.pages[0].images.totalImages).toBe(0);

    const contentOnly = await analyzeSite('https://example.com', { fromCrawl: fixturePath, content: true });
    expect(contentOnly.pages[0].title.status).toBe('missing');
    expect(contentOnly.pages[0].thinScore).toBeGreaterThanOrEqual(0);

    const accessibilityOnly = await analyzeSite('https://example.com', { fromCrawl: fixturePath, accessibility: true });
    expect(accessibilityOnly.pages[0].images.totalImages).toBeGreaterThan(0);
    expect(accessibilityOnly.pages[0].title.status).toBe('missing');
  });

  test('html report generation', async () => {
    const result = await analyzeSite('https://example.com', { fromCrawl: fixturePath });
    const html = renderAnalysisHtml(result);
    expect(html).toContain('<table');
    expect(html).toContain('Analysis');
  });

  test('default database loading', async () => {
    // Force in-memory DB for this test
    process.env.CRAWLITH_DB_PATH = ':memory:';

    // Close existing DB connection if any to ensure fresh start
    const { getDb, closeDb } = await import('../src/db/index.js');
    closeDb();

    // Setup repositories
    const { SiteRepository } = await import('../src/db/repositories/SiteRepository.js');
    const { SnapshotRepository } = await import('../src/db/repositories/SnapshotRepository.js');
    const { PageRepository } = await import('../src/db/repositories/PageRepository.js');

    const db = getDb();
    const siteRepo = new SiteRepository(db);
    const snapshotRepo = new SnapshotRepository(db);
    const pageRepo = new PageRepository(db);

    // Create site and snapshot
    const siteId = siteRepo.createSite('example.com');
    const snapshotId = snapshotRepo.createSnapshot(siteId, 'full', 'running');

    // Parse fixture and load pages into db
    const rawYaml = await fs.readFile(fixturePath, 'utf-8');
    const rawData = JSON.parse(rawYaml);
    (rawData.pages || rawData.nodes).forEach((p: any) => {
      pageRepo.upsertPage({
        site_id: siteId,
        normalized_url: p.url,
        last_seen_snapshot_id: snapshotId,
        http_status: p.status || 200,
        html: p.html || '',
        depth: p.depth || 0,
      });
    });

    snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', { node_count: 3, edge_count: 0 });

    try {
      const result = await analyzeSite('https://example.com', {});
      expect(result.site_summary.pages_analyzed).toBe(3);
    } finally {
      closeDb();
      delete process.env.CRAWLITH_DB_PATH;
    }
  });

  test('handles large html and js-only content', async () => {
    const hugeText = '<html><body><script>document.write("x")</script>' + '<p>word </p>'.repeat(1000) + '</body></html>';
    const tmpFile = path.resolve(import.meta.dirname, 'fixtures/large-analyze.json');
    await fs.writeFile(tmpFile, JSON.stringify({ pages: [{ url: 'https://example.com/', status: 200, depth: 0, html: hugeText }] }));
    const result = await analyzeSite('https://example.com', { fromCrawl: tmpFile });
    expect(result.pages[0].content.wordCount).toBe(1000);
    await fs.unlink(tmpFile);
  });
});
