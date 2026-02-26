import { describe, expect, test, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { analyzeSite, renderAnalysisHtml } from '../src/analysis/analyze.js';
import { getDb, closeDb } from '../src/db/index.js';
import { SiteRepository } from '../src/db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../src/db/repositories/SnapshotRepository.js';
import { PageRepository } from '../src/db/repositories/PageRepository.js';
import { EdgeRepository } from '../src/db/repositories/EdgeRepository.js';
import { EngineContext } from '../src/events.js';

const mockContext: EngineContext = { emit: vi.fn() };

describe('analyze integration', () => {
  const fixturePath = path.resolve(import.meta.dirname, 'fixtures/analyze-crawl.json');

  async function setupTestDb(rawData: any) {
    // Force in-memory DB for this test
    process.env.CRAWLITH_DB_PATH = ':memory:';

    // Close existing DB connection if any to ensure fresh start
    closeDb();

    const db = getDb();
    const siteRepo = new SiteRepository(db);
    const snapshotRepo = new SnapshotRepository(db);
    const pageRepo = new PageRepository(db);
    const edgeRepo = new EdgeRepository(db);

    // Create site and snapshot
    const domain = 'example.com';
    const siteId = siteRepo.createSite(domain);
    const snapshotId = snapshotRepo.createSnapshot(siteId, 'full', 'running');

    // Parse fixture and load pages into db
    const pages = rawData.pages || rawData.nodes || [];
    pages.forEach((p: any) => {
      pageRepo.upsertPage({
        site_id: siteId,
        normalized_url: p.url,
        first_seen_snapshot_id: snapshotId,
        last_seen_snapshot_id: snapshotId,
        http_status: p.status || 200,
        html: p.html || '',
        depth: p.depth || 0,
      });
    });

    if (rawData.edges) {
      rawData.edges.forEach((e: any) => {
        const sourceId = pageRepo.getIdByUrl(siteId, e.source);
        const targetId = pageRepo.getIdByUrl(siteId, e.target);
        if (sourceId && targetId) {
          edgeRepo.insertEdge(snapshotId, sourceId, targetId);
        }
      });
    }

    snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', { node_count: pages.length, edge_count: (rawData.edges || []).length });
    return { db, siteId, snapshotId };
  }

  afterEach(() => {
    closeDb();
    delete process.env.CRAWLITH_DB_PATH;
  });

  test('analyzes full crawl fixture and schema', async () => {
    const rawContent = await fs.readFile(fixturePath, 'utf-8');
    const rawData = JSON.parse(rawContent);
    await setupTestDb(rawData);

    const result = await analyzeSite('https://example.com', {}, mockContext);

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
    const rawContent = await fs.readFile(fixturePath, 'utf-8');
    const rawData = JSON.parse(rawContent);
    await setupTestDb(rawData);

    const seoOnly = await analyzeSite('https://example.com', { seo: true }, mockContext);
    expect(seoOnly.pages[0].content.wordCount).toBe(0);
    expect(seoOnly.pages[0].images.totalImages).toBe(0);

    const contentOnly = await analyzeSite('https://example.com', { content: true }, mockContext);
    expect(contentOnly.pages[0].title.status).toBe('missing');
    expect(contentOnly.pages[0].thinScore).toBeGreaterThanOrEqual(0);

    const accessibilityOnly = await analyzeSite('https://example.com', { accessibility: true }, mockContext);
    expect(accessibilityOnly.pages[0].images.totalImages).toBeGreaterThan(0);
    expect(accessibilityOnly.pages[0].title.status).toBe('missing');
  });

  test('html report generation', async () => {
    const rawContent = await fs.readFile(fixturePath, 'utf-8');
    const rawData = JSON.parse(rawContent);
    await setupTestDb(rawData);

    const result = await analyzeSite('https://example.com', {}, mockContext);
    const html = renderAnalysisHtml(result);
    expect(html).toContain('<table');
    expect(html).toContain('Analysis');
  });

  test('default database loading', async () => {
    // This is essentially same as 'analyzes full crawl fixture' but was explicit before.
    // We can keep it to verify manual DB setup works as expected (which setupTestDb does).
    const rawContent = await fs.readFile(fixturePath, 'utf-8');
    const rawData = JSON.parse(rawContent);
    await setupTestDb(rawData);

    const result = await analyzeSite('https://example.com', {}, mockContext);
    expect(result.site_summary.pages_analyzed).toBe(3);
  });

  test('handles large html and js-only content', async () => {
    const hugeText = '<html><body><script>document.write("x")</script>' + '<p>word </p>'.repeat(1000) + '</body></html>';
    const data = { pages: [{ url: 'https://example.com/', status: 200, depth: 0, html: hugeText }] };

    await setupTestDb(data);

    const result = await analyzeSite('https://example.com', {}, mockContext);
    expect(result.pages[0].content.wordCount).toBe(1000);
  });
});
