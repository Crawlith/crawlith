import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { PageRepository } from '../../src/db/repositories/PageRepository.js';
import { initSchema } from '../../src/db/schema.js';

describe('PageRepository', () => {
  let db: Database.Database;
  let repo: PageRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
    repo = new PageRepository(db);

    // Seed required tables (sites, snapshots)
    db.prepare("INSERT INTO sites (domain) VALUES ('example.com')").run();
    db.prepare("INSERT INTO snapshots (site_id, type) VALUES (1, 'full')").run();
  });

  afterEach(() => {
    db.close();
  });

  it('should get pages by URLs in chunks', () => {
    const urls: string[] = [];
    const siteId = 1;
    const snapshotId = 1;

    // Create 1000 pages (chunk size is 900)
    const insertStmt = db.prepare(`
      INSERT INTO pages (site_id, normalized_url, last_seen_snapshot_id)
      VALUES (?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        const url = `http://example.com/page${i}`;
        urls.push(url);
        insertStmt.run(siteId, url, snapshotId);
      }
    });
    tx();

    // Fetch pages
    const pages = repo.getPagesByUrls(siteId, urls);

    expect(pages).toHaveLength(1000);
    expect(pages[0].normalized_url).toBe('http://example.com/page0');
    expect(pages[999].normalized_url).toBe('http://example.com/page999');
  });

  it('should return empty array for empty URL list', () => {
    const pages = repo.getPagesByUrls(1, []);
    expect(pages).toEqual([]);
  });

  it('should iterate over pages by snapshot', () => {
    const siteId = 1;
    const snapshotId = 1;

    // Use upsertPage to ensure consistency with repo logic
    repo.upsertPage({ site_id: siteId, normalized_url: 'http://example.com/1', last_seen_snapshot_id: snapshotId });
    repo.upsertPage({ site_id: siteId, normalized_url: 'http://example.com/2', last_seen_snapshot_id: snapshotId });
    repo.upsertPage({ site_id: siteId, normalized_url: 'http://example.com/3', last_seen_snapshot_id: snapshotId });

    const iterator = repo.getPagesIteratorBySnapshot(snapshotId);
    const pages = Array.from(iterator);

    expect(pages).toHaveLength(3);
    expect(pages.map(p => p.normalized_url).sort()).toEqual([
      'http://example.com/1',
      'http://example.com/2',
      'http://example.com/3'
    ]);
  });

  it('should upsert and get ID', () => {
    const pageData = {
      site_id: 1,
      normalized_url: 'http://example.com/new',
      last_seen_snapshot_id: 1,
      http_status: 200,
    };

    const id = repo.upsertAndGetId(pageData);
    expect(id).toBeGreaterThan(0);

    const sameId = repo.upsertAndGetId({ ...pageData, http_status: 404 });
    expect(sameId).toBe(id);

    const page = repo.getPage(1, 'http://example.com/new');
    expect(page?.http_status).toBe(404);
  });

  it('should get ID by URL', () => {
    const pageData = {
        site_id: 1,
        normalized_url: 'http://example.com/id-test',
        last_seen_snapshot_id: 1,
    };
    repo.upsertPage(pageData);

    const id = repo.getIdByUrl(1, 'http://example.com/id-test');
    expect(id).toBeDefined();
    expect(id).toBeGreaterThan(0);

    const missingId = repo.getIdByUrl(1, 'http://example.com/missing');
    expect(missingId).toBeUndefined();
  });
});
