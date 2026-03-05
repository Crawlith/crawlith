import { Database } from 'better-sqlite3';

export interface Snapshot {
  id: number;
  site_id: number;
  run_type: 'completed' | 'incremental' | 'single';
  created_at: string;
  node_count: number;
  edge_count: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  limit_reached: number;
  health_score: number | null;
  orphan_count: number | null;
  thin_content_count: number | null;
}

export class SnapshotRepository {
  constructor(private db: Database) { }

  createSnapshot(siteId: number, runType: Snapshot['run_type'], status: Snapshot['status'] = 'running'): number {
    const stmt = this.db.prepare('INSERT INTO snapshots (site_id, run_type, status) VALUES (?, ?, ?)');
    const info = stmt.run(siteId, runType, status);
    return info.lastInsertRowid as number;
  }

  getLatestSnapshot(siteId: number, status?: Snapshot['status'], includeSingle: boolean = false): Snapshot | undefined {
    let sql = 'SELECT * FROM snapshots WHERE site_id = ?';
    if (!includeSingle) {
      sql += ' AND run_type != \'single\'';
    }
    const params: any[] = [siteId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC, id DESC LIMIT 1';
    return this.db.prepare(sql).get(...params) as Snapshot | undefined;
  }

  touchSnapshot(id: number): void {
    this.db.prepare(`UPDATE snapshots SET created_at = datetime('now') WHERE id = ?`).run(id);
  }

  getSnapshotCount(siteId: number): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM snapshots WHERE site_id = ?').get(siteId) as { count: number };
    return result.count;
  }

  /**
   * Returns true if the site has ever had a completed full or incremental crawl.
   * Single snapshots (from page --live) do NOT count as a "first crawl".
   */
  hasFullCrawl(siteId: number): boolean {
    const result = this.db.prepare(
      `SELECT COUNT(*) as count FROM snapshots WHERE site_id = ? AND run_type IN ('completed', 'incremental') AND status = 'completed'`
    ).get(siteId) as { count: number };
    return result.count > 0;
  }

  updateSnapshotStatus(id: number, status: Snapshot['status'], stats: Partial<Snapshot> = {}) {
    const sets: string[] = ['status = ?'];
    const params: any[] = [status];

    if (stats.node_count !== undefined) {
      sets.push('node_count = ?');
      params.push(stats.node_count);
    }
    if (stats.edge_count !== undefined) {
      sets.push('edge_count = ?');
      params.push(stats.edge_count);
    }
    if (stats.limit_reached !== undefined) {
      sets.push('limit_reached = ?');
      params.push(stats.limit_reached);
    }
    if (stats.health_score !== undefined) {
      sets.push('health_score = ?');
      params.push(stats.health_score);
    }
    if (stats.orphan_count !== undefined) {
      sets.push('orphan_count = ?');
      params.push(stats.orphan_count);
    }
    if (stats.thin_content_count !== undefined) {
      sets.push('thin_content_count = ?');
      params.push(stats.thin_content_count);
    }

    params.push(id);
    const sql = `UPDATE snapshots SET ${sets.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...params);
  }

  getSnapshot(id: number): Snapshot | undefined {
    return this.db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as Snapshot | undefined;
  }

  deleteSnapshot(id: number): void {
    const tx = this.db.transaction(() => {
      // Unlink pages from this snapshot to prevent FK constraint violations or data inconsistencies
      this.db.prepare('UPDATE pages SET first_seen_snapshot_id = NULL WHERE first_seen_snapshot_id = ?').run(id);
      this.db.prepare('UPDATE pages SET last_seen_snapshot_id = NULL WHERE last_seen_snapshot_id = ?').run(id);

      // Cleanup: Delete pages that are no longer referenced by any snapshot
      this.db.prepare('DELETE FROM pages WHERE first_seen_snapshot_id IS NULL AND last_seen_snapshot_id IS NULL').run();

      // Delete the snapshot
      this.db.prepare('DELETE FROM snapshots WHERE id = ?').run(id);
    });
    tx();
  }

  pruneSnapshots(siteId: number, maxSnapshots: number, maxSingleSnapshots: number, protectedSnapshotId?: number): void {
    const tx = this.db.transaction(() => {
      const singlesToDelete = this.db.prepare(`
        SELECT id
        FROM snapshots
        WHERE site_id = ? AND run_type = 'single'
        ORDER BY created_at DESC, id DESC
        LIMIT -1 OFFSET ?
      `).all(siteId, Math.max(0, maxSingleSnapshots)) as { id: number }[];

      const fullToDelete = this.db.prepare(`
        SELECT id
        FROM snapshots
        WHERE site_id = ? AND run_type IN ('completed', 'incremental')
        ORDER BY created_at DESC, id DESC
        LIMIT -1 OFFSET ?
      `).all(siteId, Math.max(0, maxSnapshots)) as { id: number }[];

      const ids = [...singlesToDelete, ...fullToDelete]
        .map(r => r.id)
        .filter(id => id !== protectedSnapshotId);

      for (const id of ids) {
        // Inline delete logic to keep operation inside this transaction.
        this.db.prepare('UPDATE pages SET first_seen_snapshot_id = NULL WHERE first_seen_snapshot_id = ?').run(id);
        this.db.prepare('UPDATE pages SET last_seen_snapshot_id = NULL WHERE last_seen_snapshot_id = ?').run(id);
        this.db.prepare('DELETE FROM pages WHERE first_seen_snapshot_id IS NULL AND last_seen_snapshot_id IS NULL').run();
        this.db.prepare('DELETE FROM snapshots WHERE id = ?').run(id);
      }
    });
    tx();
  }
}
