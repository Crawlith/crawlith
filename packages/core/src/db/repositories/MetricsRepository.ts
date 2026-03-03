import { Database } from 'better-sqlite3';

export interface DbMetrics {
  snapshot_id: number;
  page_id: number;


  crawl_status: string | null;
  word_count: number | null;
  thin_content_score: number | null;
  external_link_ratio: number | null;
  orphan_score: number | null;

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
        orphan_score
      ) VALUES (
        @snapshot_id, @page_id,
        @crawl_status, @word_count, @thin_content_score, @external_link_ratio,
        @orphan_score
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
