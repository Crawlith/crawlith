import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runBaseMigrations } from '../src/db/migrations.js';
import { SiteRepository } from '../src/db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../src/db/repositories/SnapshotRepository.js';
import { PageRepository } from '../src/db/repositories/PageRepository.js';
import { EdgeRepository } from '../src/db/repositories/EdgeRepository.js';
import { MetricsRepository } from '../src/db/repositories/MetricsRepository.js';

describe('Database Layer', () => {
  let db: Database.Database;
  let siteRepo: SiteRepository;
  let snapshotRepo: SnapshotRepository;
  let pageRepo: PageRepository;
  let edgeRepo: EdgeRepository;
  let metricsRepo: MetricsRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    runBaseMigrations(db);
    siteRepo = new SiteRepository(db);
    snapshotRepo = new SnapshotRepository(db);
    pageRepo = new PageRepository(db);
    edgeRepo = new EdgeRepository(db);
    metricsRepo = new MetricsRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should create and retrieve a site', () => {
    const domain = 'example.com';
    const id = siteRepo.createSite(domain);
    expect(id).toBeGreaterThan(0);

    const site = siteRepo.getSite(domain);
    expect(site).toBeDefined();
    expect(site?.domain).toBe(domain);
  });

  it('should create and retrieve a snapshot', () => {
    const siteId = siteRepo.createSite('example.com');
    const snapshotId = snapshotRepo.createSnapshot(siteId, 'completed', 'running');
    expect(snapshotId).toBeGreaterThan(0);

    const snapshot = snapshotRepo.getLatestSnapshot(siteId);
    expect(snapshot).toBeDefined();
    expect(snapshot?.status).toBe('running');

    snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', { node_count: 10, edge_count: 5 });
    const updated = snapshotRepo.getLatestSnapshot(siteId);
    expect(updated?.status).toBe('completed');
    expect(updated?.node_count).toBe(10);
  });

  it('should upsert pages', () => {
    const siteId = siteRepo.createSite('example.com');
    const snapshotId = snapshotRepo.createSnapshot(siteId, 'completed');
    const url = 'http://example.com';

    // First insert
    pageRepo.upsertPage({
      site_id: siteId,
      normalized_url: url,
      last_seen_snapshot_id: snapshotId,
      http_status: 200,
      depth: 0
    });

    let page = pageRepo.getPage(siteId, url);
    expect(page).toBeDefined();
    expect(page?.first_seen_snapshot_id).toBe(snapshotId);
    expect(page?.last_seen_snapshot_id).toBe(snapshotId);
    expect(page?.http_status).toBe(200);

    // Update (second snapshot)
    const snapshotId2 = snapshotRepo.createSnapshot(siteId, 'incremental');
    pageRepo.upsertPage({
      site_id: siteId,
      normalized_url: url,
      last_seen_snapshot_id: snapshotId2,
      http_status: 200, // same status
      depth: 0
    });

    page = pageRepo.getPage(siteId, url);
    expect(page?.first_seen_snapshot_id).toBe(snapshotId); // Should remain the first one
    expect(page?.last_seen_snapshot_id).toBe(snapshotId2); // Should update to the second one
  });

  it('should persist new columns (nofollow, security_error, retries)', () => {
    const siteId = siteRepo.createSite('new-cols.com');
    const snapshotId = snapshotRepo.createSnapshot(siteId, 'completed');
    const url = 'http://new-cols.com';

    pageRepo.upsertPage({
      site_id: siteId,
      normalized_url: url,
      last_seen_snapshot_id: snapshotId,
      nofollow: 1,
      security_error: 'blocked',
      retries: 3
    });

    const page = pageRepo.getPage(siteId, url);
    expect(page?.nofollow).toBe(1);
    expect(page?.security_error).toBe('blocked');
    expect(page?.retries).toBe(3);
  });

  it('should insert and retrieve edges', () => {
    const siteId = siteRepo.createSite('example.com');
    const snapshotId = snapshotRepo.createSnapshot(siteId, 'completed');

    // Create pages first
    pageRepo.upsertPage({ site_id: siteId, normalized_url: 'http://example.com/1', last_seen_snapshot_id: snapshotId });
    pageRepo.upsertPage({ site_id: siteId, normalized_url: 'http://example.com/2', last_seen_snapshot_id: snapshotId });

    const p1 = pageRepo.getPage(siteId, 'http://example.com/1')!;
    const p2 = pageRepo.getPage(siteId, 'http://example.com/2')!;

    edgeRepo.insertEdge(snapshotId, p1.id, p2.id, 1.0, 'internal');

    const edges = edgeRepo.getEdgesBySnapshot(snapshotId);
    expect(edges).toHaveLength(1);
    expect(edges[0].source_page_id).toBe(p1.id);
    expect(edges[0].target_page_id).toBe(p2.id);
  });

  it('should insert and retrieve metrics', () => {
    const siteId = siteRepo.createSite('example.com');
    const snapshotId = snapshotRepo.createSnapshot(siteId, 'completed');
    pageRepo.upsertPage({ site_id: siteId, normalized_url: 'http://example.com/1', last_seen_snapshot_id: snapshotId });
    const p1 = pageRepo.getPage(siteId, 'http://example.com/1')!;

    metricsRepo.insertMetrics({
      snapshot_id: snapshotId,
      page_id: p1.id,
      crawl_status: 'fetched',
      word_count: 100,
      thin_content_score: 0.1,
      external_link_ratio: 0.0,
      orphan_score: 0,
      pagerank_score: 0,
      hub_score: 0,
      auth_score: 0,
      link_role: null,
      duplicate_cluster_id: null,
      duplicate_type: null,
      cluster_id: null,
      soft404_score: 0,
      heading_score: 0,
      orphan_type: null,
      impact_level: null,
      heading_data: null,
      is_cluster_primary: 0
    });

    const metrics = metricsRepo.getMetricsForPage(snapshotId, p1.id);
    expect(metrics).toBeDefined();
    expect(metrics?.crawl_status).toBe('fetched');
    expect(metrics?.word_count).toBe(100);
  });
});
