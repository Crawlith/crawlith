import { Database } from 'better-sqlite3';

export interface Snapshot {
  id: number;
  site_id: number;
  type: 'full' | 'partial' | 'incremental';
  created_at: string;
  node_count: number;
  edge_count: number;
  status: 'running' | 'completed' | 'failed';
  limit_reached: number;
  health_score: number | null;
  orphan_count: number | null;
  thin_content_count: number | null;
}

export class SnapshotRepository {
  constructor(private db: Database) { }

  createSnapshot(siteId: number, type: 'full' | 'partial' | 'incremental', status: 'running' | 'completed' | 'failed' = 'running'): number {
    // Basic throttling or sleep if needed for tests, but generally SQLite is fast enough to have diff timestamps if not in same ms.
    // However, if we run in memory, created_at is default current time.
    // If two snapshots created in same second, ORDER BY created_at DESC is unstable or equal.
    // We should rely on ID for stability if timestamps are equal, but the query uses created_at.
    // Let's ensure we can also order by ID as tie-breaker.
    const stmt = this.db.prepare('INSERT INTO snapshots (site_id, type, status) VALUES (?, ?, ?)');
    const info = stmt.run(siteId, type, status);
    return info.lastInsertRowid as number;
  }

  getLatestSnapshot(siteId: number, status?: 'completed' | 'running' | 'failed'): Snapshot | undefined {
    let sql = 'SELECT * FROM snapshots WHERE site_id = ? AND type != \'partial\'';
    const params: any[] = [siteId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC, id DESC LIMIT 1';
    return this.db.prepare(sql).get(...params) as Snapshot | undefined;
  }

  getSnapshotCount(siteId: number): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM snapshots WHERE site_id = ?').get(siteId) as { count: number };
    return result.count;
  }

  updateSnapshotStatus(id: number, status: 'completed' | 'failed', stats: Partial<Snapshot> = {}) {
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
}
