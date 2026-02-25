import { Database } from 'better-sqlite3';

export interface Edge {
  id: number;
  snapshot_id: number;
  source_page_id: number;
  target_page_id: number;
  rel: 'nofollow' | 'sponsored' | 'ugc' | 'internal' | 'external' | 'unknown';
}

export class EdgeRepository {
  private insertStmt;

  constructor(private db: Database) {
    this.insertStmt = this.db.prepare(`
      INSERT INTO edges (snapshot_id, source_page_id, target_page_id, rel)
      VALUES (?, ?, ?, ?)
    `);
  }

  insertEdge(snapshotId: number, sourcePageId: number, targetPageId: number, rel: string = 'internal') {
    this.insertStmt.run(snapshotId, sourcePageId, targetPageId, rel);
  }

  getEdgesBySnapshot(snapshotId: number): Edge[] {
      return this.db.prepare('SELECT * FROM edges WHERE snapshot_id = ?').all(snapshotId) as Edge[];
  }
}
