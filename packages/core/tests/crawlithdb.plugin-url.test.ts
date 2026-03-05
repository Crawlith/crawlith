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
});
