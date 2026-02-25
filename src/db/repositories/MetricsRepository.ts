import { Database } from 'better-sqlite3';

export interface Metrics {
  snapshot_id: number;
  page_id: number;
  authority_score: number | null;
  hub_score: number | null;
  pagerank: number | null;
  crawl_status: string | null;
  word_count: number | null;
  thin_content_score: number | null;
  external_link_ratio: number | null;
  orphan_score: number | null;
}

export class MetricsRepository {
  private insertStmt;

  constructor(private db: Database) {
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO metrics (
        snapshot_id, page_id, authority_score, hub_score, pagerank, crawl_status, word_count,
        thin_content_score, external_link_ratio, orphan_score
      ) VALUES (
        @snapshot_id, @page_id, @authority_score, @hub_score, @pagerank, @crawl_status, @word_count,
        @thin_content_score, @external_link_ratio, @orphan_score
      )
    `);
  }

  insertMetrics(metrics: Metrics) {
    this.insertStmt.run(metrics);
  }

  getMetrics(snapshotId: number): Metrics[] {
    return this.db.prepare('SELECT * FROM metrics WHERE snapshot_id = ?').all(snapshotId) as Metrics[];
  }

  getMetricsForPage(snapshotId: number, pageId: number): Metrics | undefined {
      return this.db.prepare('SELECT * FROM metrics WHERE snapshot_id = ? AND page_id = ?').get(snapshotId, pageId) as Metrics | undefined;
  }
}
