import { Database } from 'better-sqlite3';

export interface DbMetrics {
  snapshot_id: number;
  page_id: number;
  authority_score: number | null;
  hub_score: number | null;
  pagerank: number | null;
  pagerank_score: number | null;
  link_role: 'hub' | 'authority' | 'power' | 'balanced' | 'peripheral' | null;
  crawl_status: string | null;
  word_count: number | null;
  thin_content_score: number | null;
  external_link_ratio: number | null;
  orphan_score: number | null;
  duplicate_cluster_id: string | null;
  duplicate_type: 'exact' | 'near' | 'template_heavy' | 'none' | null;
  is_cluster_primary: number;
}

export class MetricsRepository {
  private insertStmt;

  constructor(private db: Database) {
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO metrics (
        snapshot_id, page_id, authority_score, hub_score, pagerank, pagerank_score,
        link_role, crawl_status, word_count, thin_content_score, external_link_ratio,
        orphan_score, duplicate_cluster_id, duplicate_type, is_cluster_primary
      ) VALUES (
        @snapshot_id, @page_id, @authority_score, @hub_score, @pagerank, @pagerank_score,
        @link_role, @crawl_status, @word_count, @thin_content_score, @external_link_ratio,
        @orphan_score, @duplicate_cluster_id, @duplicate_type, @is_cluster_primary
      )
    `);
  }

  insertMetrics(metrics: DbMetrics) {
    this.insertStmt.run(metrics);
  }

  getMetrics(snapshotId: number): DbMetrics[] {
    return this.db.prepare('SELECT * FROM metrics WHERE snapshot_id = ?').all(snapshotId) as DbMetrics[];
  }

  getMetricsForPage(snapshotId: number, pageId: number): DbMetrics | undefined {
    return this.db.prepare('SELECT * FROM metrics WHERE snapshot_id = ? AND page_id = ?').get(snapshotId, pageId) as DbMetrics | undefined;
  }
}
