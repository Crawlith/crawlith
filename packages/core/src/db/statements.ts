import { Database, Statement } from 'better-sqlite3';

export class Statements {
  public getPageIdByUrl: Statement;
  public insertPluginReport: Statement;
  public getPluginReport: Statement;
  public deleteSnapshotPlugins: Statement;
  public getSnapshot: Statement;
  public getMigration: Statement;
  public insertMigration: Statement;

  constructor(private db: Database) {
    this.getPageIdByUrl = this.db.prepare(`
      SELECT id FROM pages 
      WHERE site_id = (SELECT site_id FROM snapshots WHERE id = ?) 
      AND normalized_url = ?
    `);

    this.insertPluginReport = this.db.prepare(`
      INSERT OR REPLACE INTO plugin_reports 
      (snapshot_id, plugin_name, data, total_score, score_count, score_weight_sum, score_calculated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.getPluginReport = this.db.prepare(`
      SELECT data FROM plugin_reports 
      WHERE snapshot_id = ? AND plugin_name = ?
      ORDER BY created_at DESC LIMIT 1
    `);

    this.deleteSnapshotPlugins = this.db.prepare(`
      DELETE FROM plugin_reports WHERE snapshot_id = ?
    `);

    this.getSnapshot = this.db.prepare(`
      SELECT id FROM snapshots WHERE id = ?
    `);

    this.getMigration = this.db.prepare(`
      SELECT plugin_name FROM plugin_migrations WHERE plugin_name = ?
    `);

    this.insertMigration = this.db.prepare(`
      INSERT INTO plugin_migrations (plugin_name) VALUES (?)
    `);
  }
}
