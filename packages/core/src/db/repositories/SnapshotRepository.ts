import { Database } from 'better-sqlite3';
import { isPidAlive } from '../../lock/pidCheck.js';

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
  /** Process that created the snapshot; lets a later run tell an abandoned `running` row from a live one. */
  pid: number | null;
}

/** Statuses a `running` snapshot may end in. Once ended, a snapshot's status never changes again. */
export type SnapshotEndStatus = 'completed' | 'failed' | 'cancelled';

type SnapshotStats = Partial<Pick<Snapshot, 'node_count' | 'edge_count' | 'limit_reached' | 'health_score' | 'orphan_count' | 'thin_content_count'>>;

const STAT_COLUMNS = ['node_count', 'edge_count', 'limit_reached', 'health_score', 'orphan_count', 'thin_content_count'] as const;

export class SnapshotRepository {
  constructor(private db: Database) { }

  createSnapshot(siteId: number, runType: Snapshot['run_type'], status: Snapshot['status'] = 'running'): number {
    const stmt = this.db.prepare('INSERT INTO snapshots (site_id, run_type, status, pid) VALUES (?, ?, ?, ?)');
    const info = stmt.run(siteId, runType, status, process.pid);
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

  /**
   * Ends a running snapshot. Returns false, changing nothing, when the snapshot has already ended,
   * so a late or repeated call can never move a finished snapshot to another status.
   */
  finishSnapshot(id: number, status: SnapshotEndStatus, stats: SnapshotStats = {}): boolean {
    const { sets, params } = this.statAssignments(stats);
    const sql = `UPDATE snapshots SET ${['status = ?', ...sets].join(', ')} WHERE id = ? AND status = 'running'`;
    return this.db.prepare(sql).run(status, ...params, id).changes > 0;
  }

  /** Records computed stats on a snapshot without touching its status. */
  updateSnapshotStats(id: number, stats: SnapshotStats): void {
    const { sets, params } = this.statAssignments(stats);
    if (sets.length === 0) return;
    this.db.prepare(`UPDATE snapshots SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  }

  /**
   * Marks `running` snapshots as failed when the process that created them is gone (killed, crashed or
   * from a version that did not record its pid). Snapshots owned by this process or a live one are left alone.
   */
  failAbandonedSnapshots(isAlive: (pid: number) => boolean = isPidAlive): number {
    const running = this.db.prepare(`SELECT id, pid FROM snapshots WHERE status = 'running'`).all() as { id: number; pid: number | null }[];
    const abandoned = running.filter(s => s.pid === null || (s.pid !== process.pid && !isAlive(s.pid)));
    let failed = 0;
    for (const { id } of abandoned) {
      if (this.finishSnapshot(id, 'failed')) failed++;
    }
    return failed;
  }

  private statAssignments(stats: SnapshotStats): { sets: string[]; params: unknown[] } {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const column of STAT_COLUMNS) {
      if (stats[column] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(stats[column]);
      }
    }
    return { sets, params };
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
