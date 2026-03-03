import { Database } from 'better-sqlite3';

export interface DbMetrics {
  snapshot_id: number;
  page_id: number;


  crawl_status: string | null;
  word_count: number | null;
  thin_content_score: number | null;
  external_link_ratio: number | null;
  pagerank_score: number | null;
  hub_score: number | null;
  auth_score: number | null;
  link_role: string | null;
  duplicate_cluster_id: string | null;
  duplicate_type: string | null;
  cluster_id: number | null;
  soft404_score: number | null;
  heading_score: number | null;
  orphan_score: number | null;
  orphan_type: string | null;
  impact_level: string | null;
  heading_data: string | null;
  is_cluster_primary: number | null;
}

export class MetricsRepository {
  private insertStmt;
  private getByPageStmt;

  constructor(private db: Database) {
    this.getByPageStmt = this.db.prepare('SELECT * FROM metrics WHERE snapshot_id = ? AND page_id = ?');
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO metrics (
        snapshot_id, page_id,
        crawl_status, word_count, thin_content_score, external_link_ratio,
        pagerank_score, hub_score, auth_score, link_role,
        duplicate_cluster_id, duplicate_type, cluster_id,
        soft404_score, heading_score,
        orphan_score, orphan_type, impact_level,
        heading_data, is_cluster_primary
      ) VALUES (
        @snapshot_id, @page_id,
        @crawl_status, @word_count, @thin_content_score, @external_link_ratio,
        @pagerank_score, @hub_score, @auth_score, @link_role,
        @duplicate_cluster_id, @duplicate_type, @cluster_id,
        @soft404_score, @heading_score,
        @orphan_score, @orphan_type, @impact_level,
        @heading_data, @is_cluster_primary
      )
    `);
  }

  insertMetrics(metrics: DbMetrics) {
    this.insertStmt.run(metrics);
  }

  getMetrics(snapshotId: number): DbMetrics[] {
    return this.db.prepare('SELECT * FROM metrics WHERE snapshot_id = ?').all(snapshotId) as DbMetrics[];
  }

  getMetricsIterator(snapshotId: number): IterableIterator<DbMetrics> {
    return this.db.prepare('SELECT * FROM metrics WHERE snapshot_id = ?').iterate(snapshotId) as IterableIterator<DbMetrics>;
  }

  getMetricsForPage(snapshotId: number, pageId: number): DbMetrics | undefined {
    return this.getByPageStmt.get(snapshotId, pageId) as DbMetrics | undefined;
  }

  insertMany(metricsList: DbMetrics[]) {
    const insert = this.insertStmt;
    const tx = this.db.transaction((items: DbMetrics[]) => {
      for (const item of items) insert.run(item);
    });
    tx(metricsList);
  }
}
