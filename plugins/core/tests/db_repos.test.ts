import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/schema.js';
import { SiteRepository } from '../src/db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../src/db/repositories/SnapshotRepository.js';

describe('SiteRepository & SnapshotRepository', () => {
  let db: Database.Database;
  let siteRepo: SiteRepository;
  let snapshotRepo: SnapshotRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
    siteRepo = new SiteRepository(db);
    snapshotRepo = new SnapshotRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('getAllSites should return all sites ordered by domain', () => {
    siteRepo.createSite('b.com');
    siteRepo.createSite('a.com');
    siteRepo.createSite('c.com');

    const sites = siteRepo.getAllSites();
    expect(sites).toHaveLength(3);
    expect(sites[0].domain).toBe('a.com');
    expect(sites[1].domain).toBe('b.com');
    expect(sites[2].domain).toBe('c.com');
  });

  it('getSnapshotCount should return correct count', () => {
    const siteId = siteRepo.createSite('test.com');

    expect(snapshotRepo.getSnapshotCount(siteId)).toBe(0);

    snapshotRepo.createSnapshot(siteId, 'full');
    expect(snapshotRepo.getSnapshotCount(siteId)).toBe(1);

    snapshotRepo.createSnapshot(siteId, 'partial');
    expect(snapshotRepo.getSnapshotCount(siteId)).toBe(2);
  });

  it('getLatestSnapshot should return the latest snapshot', () => {
    const siteId = siteRepo.createSite('test.com');

    // First snapshot
    snapshotRepo.createSnapshot(siteId, 'full', 'completed');
    // Wait a tiny bit to ensure timestamp diff if needed, but synchronous execution usually implies order

    // Second snapshot
    const secondId = snapshotRepo.createSnapshot(siteId, 'full', 'running');

    const latest = snapshotRepo.getLatestSnapshot(siteId);
    expect(latest).toBeDefined();
    expect(latest?.id).toBe(secondId);
    expect(latest?.status).toBe('running');
  });

  it('getLatestSnapshot with status filter', () => {
    const siteId = siteRepo.createSite('test.com');
    const firstId = snapshotRepo.createSnapshot(siteId, 'full', 'completed');
    snapshotRepo.createSnapshot(siteId, 'full', 'running');

    const latestCompleted = snapshotRepo.getLatestSnapshot(siteId, 'completed');
    expect(latestCompleted).toBeDefined();
    expect(latestCompleted?.id).toBe(firstId);
  });
});
