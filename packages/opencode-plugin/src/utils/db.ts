import { getDb } from '@crawlith/core';

const MAX_LIST_ITEMS = 200;

/**
 * Resolves a snapshot row or throws if missing.
 */
export function requireSnapshot(snapshotId: number): { id: number; site_id: number; status: string } {
  const db = getDb();
  const snapshot = db
    .prepare('SELECT id, site_id, status FROM snapshots WHERE id = ? LIMIT 1')
    .get(snapshotId) as { id: number; site_id: number; status: string } | undefined;

  if (!snapshot) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  return snapshot;
}

/**
 * Truncates oversized arrays for AI-safe response payloads.
 */
export function truncateList<T>(items: T[], maxItems: number = MAX_LIST_ITEMS): T[] {
  return items.length > maxItems ? items.slice(0, maxItems) : items;
}
