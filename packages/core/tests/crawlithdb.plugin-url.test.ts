import { describe, it, expect } from 'vitest';
import { CrawlithDB } from '../src/db/CrawlithDB.js';
import { SiteRepository } from '../src/db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../src/db/repositories/SnapshotRepository.js';
import { PageRepository } from '../src/db/repositories/PageRepository.js';

describe('CrawlithDB plugin URL lookup', () => {
  it('resolves page id for root-relative URLs', () => {
    const db = new CrawlithDB(':memory:');
    try {
      const raw = db.unsafeGetRawDb();
      const siteRepo = new SiteRepository(raw);
      const snapshotRepo = new SnapshotRepository(raw);
      const pageRepo = new PageRepository(raw);

      const siteId = siteRepo.createSite('example.com');
      const snapshotId = snapshotRepo.createSnapshot(siteId, 'completed', 'completed');
      pageRepo.upsertPage({
        site_id: siteId,
        normalized_url: '/cfp/test-page',
        last_seen_snapshot_id: snapshotId,
        http_status: 200,
        depth: 1,
        is_internal: 1
      });

      const pageId = db.getPageIdByUrl(snapshotId, '/cfp/test-page');
      expect(pageId).toBeTypeOf('number');
      expect(pageId).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  it('resolves page id for absolute URLs mapped to stored path', () => {
    const db = new CrawlithDB(':memory:');
    try {
      const raw = db.unsafeGetRawDb();
      const siteRepo = new SiteRepository(raw);
      const snapshotRepo = new SnapshotRepository(raw);
      const pageRepo = new PageRepository(raw);

      const siteId = siteRepo.createSite('example.com');
      const snapshotId = snapshotRepo.createSnapshot(siteId, 'completed', 'completed');
      pageRepo.upsertPage({
        site_id: siteId,
        normalized_url: '/cfp/test-page-2',
        last_seen_snapshot_id: snapshotId,
        http_status: 200,
        depth: 1,
        is_internal: 1
      });

      const pageId = db.getPageIdByUrl(snapshotId, 'https://example.com/cfp/test-page-2');
      expect(pageId).toBeTypeOf('number');
      expect(pageId).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  it('resolves page id when input URL and stored URL differ only by trailing slash', () => {
    const db = new CrawlithDB(':memory:');
    try {
      const raw = db.unsafeGetRawDb();
      const siteRepo = new SiteRepository(raw);
      const snapshotRepo = new SnapshotRepository(raw);
      const pageRepo = new PageRepository(raw);

      const siteId = siteRepo.createSite('example.com');
      const snapshotId = snapshotRepo.createSnapshot(siteId, 'completed', 'completed');
      pageRepo.upsertPage({
        site_id: siteId,
        normalized_url: '/cfp/test-page-3',
        last_seen_snapshot_id: snapshotId,
        http_status: 200,
        depth: 1,
        is_internal: 1
      });

      const pageId = db.getPageIdByUrl(snapshotId, 'https://example.com/cfp/test-page-3/');
      expect(pageId).toBeTypeOf('number');
      expect(pageId).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  it('materializes snapshot-local plugin rows on global cache hit', async () => {
    const db = new CrawlithDB(':memory:');
    try {
      const raw = db.unsafeGetRawDb();
      const siteRepo = new SiteRepository(raw);
      const snapshotRepo = new SnapshotRepository(raw);
      const pageRepo = new PageRepository(raw);

      const siteId = siteRepo.createSite('example.com');
      const snapshotOne = snapshotRepo.createSnapshot(siteId, 'completed', 'completed');
      const snapshotTwo = snapshotRepo.createSnapshot(siteId, 'completed', 'completed');

      pageRepo.upsertPage({
        site_id: siteId,
        normalized_url: '/cfp/test-page-4',
        first_seen_snapshot_id: snapshotOne,
        last_seen_snapshot_id: snapshotTwo,
        http_status: 200,
        depth: 1,
        is_internal: 1
      });

      const scopedOne = db.scope('signals', snapshotOne, { fetchMode: 'local' });
      scopedOne.schema.define({ status: 'TEXT', has_og: 'INTEGER' });
      await scopedOne.data.getOrFetch('/cfp/test-page-4', async () => ({
        status: 'ok',
        has_og: 1,
        score: 80,
        weight: 1
      }));

      const scopedTwo = db.scope('signals', snapshotTwo, { fetchMode: 'local' });
      const cached = await scopedTwo.data.getOrFetch('/cfp/test-page-4', async () => {
        throw new Error('cache miss is not expected');
      });

      // A second cache hit in the same snapshot should not duplicate rows.
      await scopedTwo.data.getOrFetch('/cfp/test-page-4', async () => ({
        status: 'should-not-run',
        has_og: 0,
        score: 1,
        weight: 1
      }));

      expect(cached).not.toBeNull();

      const rowsOne = raw.prepare('SELECT COUNT(*) as c FROM signals_plugin WHERE snapshot_id = ?').get(snapshotOne) as { c: number };
      const rowsTwo = raw.prepare('SELECT COUNT(*) as c FROM signals_plugin WHERE snapshot_id = ?').get(snapshotTwo) as { c: number };
      expect(rowsOne.c).toBe(1);
      expect(rowsTwo.c).toBe(1);
    } finally {
      db.close();
    }
  });
});
