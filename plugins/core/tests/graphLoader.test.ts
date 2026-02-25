import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadGraphFromSnapshot } from '../src/db/graphLoader.js';
import { getDb, closeDb } from '../src/db/index.js';
import { SiteRepository } from '../src/db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../src/db/repositories/SnapshotRepository.js';
import { PageRepository } from '../src/db/repositories/PageRepository.js';
import { MetricsRepository } from '../src/db/repositories/MetricsRepository.js';
import { Database } from 'better-sqlite3';

describe('GraphLoader', () => {
    let db: Database;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
        closeDb();
        db = getDb();
    });

    afterEach(() => {
        closeDb();
    });

    it('should load graph with metrics correctly', () => {
        const siteRepo = new SiteRepository(db);
        const snapshotRepo = new SnapshotRepository(db);
        const pageRepo = new PageRepository(db);
        const metricsRepo = new MetricsRepository(db);

        const siteId = siteRepo.createSite('example.com');
        const snapshotId = snapshotRepo.createSnapshot(siteId, 'full');
        const url = 'http://example.com/page1';

        // Create Page
        pageRepo.upsertPage({
            site_id: siteId,
            normalized_url: url,
            last_seen_snapshot_id: snapshotId,
            http_status: 200,
            depth: 0
        });
        const page = pageRepo.getPage(siteId, url)!;

        // Insert Metrics
        metricsRepo.insertMetrics({
            snapshot_id: snapshotId,
            page_id: page.id,
            authority_score: 0.5,
            hub_score: 0.2,
            pagerank: 0.8,
            pagerank_score: 80.0,
            link_role: 'authority',
            crawl_status: 'fetched',
            word_count: 500,
            thin_content_score: 10,
            external_link_ratio: 0.1,
            orphan_score: 5,
            duplicate_cluster_id: null,
            duplicate_type: null,
            is_cluster_primary: 1
        });

        // Load Graph
        const graph = loadGraphFromSnapshot(snapshotId);
        const node = graph.nodes.get(url);

        expect(node).toBeDefined();
        expect(node?.authorityScore).toBe(0.5);
        expect(node?.hubScore).toBe(0.2);
        // Verify new fields
        expect(node?.crawlStatus).toBe('fetched');
        expect(node?.wordCount).toBe(500);
        expect(node?.thinContentScore).toBe(10);
        expect(node?.externalLinkRatio).toBe(0.1);
        expect(node?.orphanScore).toBe(5);
    });

    it('should handle null metrics gracefully', () => {
        const siteRepo = new SiteRepository(db);
        const snapshotRepo = new SnapshotRepository(db);
        const pageRepo = new PageRepository(db);
        const metricsRepo = new MetricsRepository(db);

        const siteId = siteRepo.createSite('example.com');
        const snapshotId = snapshotRepo.createSnapshot(siteId, 'full');
        const url = 'http://example.com/page2';

        pageRepo.upsertPage({
            site_id: siteId,
            normalized_url: url,
            last_seen_snapshot_id: snapshotId,
            http_status: 200,
            depth: 1
        });
        const page = pageRepo.getPage(siteId, url)!;

        // Insert Metrics with nulls
        metricsRepo.insertMetrics({
            snapshot_id: snapshotId,
            page_id: page.id,
            authority_score: null,
            hub_score: null,
            pagerank: null,
            pagerank_score: null,
            link_role: null,
            crawl_status: null,
            word_count: null,
            thin_content_score: null,
            external_link_ratio: null,
            orphan_score: null,
            duplicate_cluster_id: null,
            duplicate_type: null,
            is_cluster_primary: 0
        });

        const graph = loadGraphFromSnapshot(snapshotId);
        const node = graph.nodes.get(url);

        expect(node).toBeDefined();
        // Check undefined
        expect(node?.crawlStatus).toBeUndefined();
        expect(node?.wordCount).toBeUndefined();
        expect(node?.thinContentScore).toBeUndefined();
    });
});
