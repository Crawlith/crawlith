import { Database } from 'better-sqlite3';

export function runBaseMigrations(db: Database) {
  // Sites Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      settings_json TEXT,
      is_active INTEGER DEFAULT 1
    );
  `);

  // Snapshots Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('full', 'partial', 'incremental')) NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      node_count INTEGER DEFAULT 0,
      edge_count INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('running', 'completed', 'failed')) DEFAULT 'running',
      limit_reached INTEGER DEFAULT 0,
      health_score REAL,
      orphan_count INTEGER,
      thin_content_count INTEGER,
      total_score REAL,
      score_count INTEGER,
      score_weight_sum REAL,
      score_calculated_at TEXT,
      FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
    );
  `);

  // Pages Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      normalized_url TEXT NOT NULL,
      first_seen_snapshot_id INTEGER,
      last_seen_snapshot_id INTEGER,
      http_status INTEGER,
      canonical_url TEXT,
      content_hash TEXT,
      simhash TEXT,
      etag TEXT,
      last_modified TEXT,
      html TEXT,
      soft404_score REAL,
      noindex INTEGER DEFAULT 0,
      nofollow INTEGER DEFAULT 0,
      security_error TEXT,
      retries INTEGER DEFAULT 0,
      depth INTEGER DEFAULT 0,
      discovered_via_sitemap INTEGER DEFAULT 0,
      redirect_chain TEXT,
      bytes_received INTEGER,
      crawl_trap_flag INTEGER DEFAULT 0,
      crawl_trap_risk REAL,
      trap_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY(first_seen_snapshot_id) REFERENCES snapshots(id),
      FOREIGN KEY(last_seen_snapshot_id) REFERENCES snapshots(id),
      UNIQUE(site_id, normalized_url)
    );
  `);

  // Migrations for existing tables
  try { db.exec(`ALTER TABLE pages ADD COLUMN discovered_via_sitemap INTEGER DEFAULT 0;`); } catch (_e) { /* ignore */ }
  try { db.exec(`ALTER TABLE pages ADD COLUMN soft404_score REAL;`); } catch (_e) { /* ignore */ }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_pages_site_last_seen ON pages(site_id, last_seen_snapshot_id);`);

  // Edges Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL,
      source_page_id INTEGER NOT NULL,
      target_page_id INTEGER NOT NULL,
      weight REAL DEFAULT 1.0,
      rel TEXT CHECK(rel IN ('nofollow', 'sponsored', 'ugc', 'internal', 'external', 'unknown')) DEFAULT 'internal',
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      FOREIGN KEY(source_page_id) REFERENCES pages(id) ON DELETE CASCADE,
      FOREIGN KEY(target_page_id) REFERENCES pages(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_snapshot ON edges(snapshot_id);`);

  // Metrics Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      snapshot_id INTEGER NOT NULL,
      page_id INTEGER NOT NULL,
      authority_score REAL,
      hub_score REAL,
      pagerank REAL,
      pagerank_score REAL,
      link_role TEXT,
      crawl_status TEXT,
      word_count INTEGER,
      thin_content_score REAL,
      external_link_ratio REAL,
      orphan_score INTEGER,
      duplicate_cluster_id TEXT,
      duplicate_type TEXT,
      is_cluster_primary INTEGER DEFAULT 0,
      PRIMARY KEY(snapshot_id, page_id),
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_snapshot ON metrics(snapshot_id);`);

  // Duplicate Clusters Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_clusters (
      id TEXT NOT NULL,
      snapshot_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('exact', 'near', 'template_heavy')) NOT NULL,
      size INTEGER NOT NULL,
      representative TEXT NOT NULL,
      severity TEXT CHECK(severity IN ('low', 'medium', 'high')) NOT NULL,
      PRIMARY KEY(snapshot_id, id),
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );
  `);

  // Content Clusters Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_clusters (
      id INTEGER NOT NULL,
      snapshot_id INTEGER NOT NULL,
      count INTEGER NOT NULL,
      primary_url TEXT NOT NULL,
      risk TEXT CHECK(risk IN ('low', 'medium', 'high')) NOT NULL,
      shared_path_prefix TEXT,
      PRIMARY KEY(snapshot_id, id),
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );
  `);

  // Plugin Migrations Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_migrations (
      plugin_name TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Universal Plugin Reports Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL,
      plugin_name TEXT NOT NULL,
      data TEXT NOT NULL,
      total_score REAL,
      score_count INTEGER,
      score_weight_sum REAL,
      score_calculated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_plugin_reports_snapshot ON plugin_reports(snapshot_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_plugin_reports_composite ON plugin_reports(snapshot_id, plugin_name);`);
}
