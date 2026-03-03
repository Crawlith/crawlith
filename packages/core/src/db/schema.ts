import { Database } from 'better-sqlite3';

export function initSchema(db: Database) {
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

  // Index for Pages
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

  // Index for Edges
  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_snapshot_source ON edges(snapshot_id, source_page_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_snapshot ON edges(snapshot_id);`);

  // Metrics Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      snapshot_id INTEGER NOT NULL,
      page_id INTEGER NOT NULL,
      crawl_status TEXT,
      word_count INTEGER,
      thin_content_score REAL,
      external_link_ratio REAL,
      pagerank_score REAL,
      hub_score REAL,
      auth_score REAL,
      link_role TEXT,
      duplicate_cluster_id TEXT,
      duplicate_type TEXT,
      cluster_id INTEGER,
      soft404_score REAL,
      heading_score REAL,
      orphan_score INTEGER,
      orphan_type TEXT,
      impact_level TEXT,
      PRIMARY KEY(snapshot_id, page_id),
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_snapshot ON metrics(snapshot_id);`);



  // Plugin Reports Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_reports (
      snapshot_id INTEGER NOT NULL,
      plugin_name TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (snapshot_id, plugin_name),
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_plugin_reports_snapshot ON plugin_reports(snapshot_id);`);

  // Migration: add columns to existing DBs that were created before this update
  migrateSchema(db);
}

function migrateSchema(db: Database) {
  // Add missing columns to pages (safe: ALTER TABLE ADD COLUMN is idempotent-safe with try/catch)
  const pageColumns = [
    ['depth', 'INTEGER DEFAULT 0'],
    ['discovered_via_sitemap', 'INTEGER DEFAULT 0'],
    ['redirect_chain', 'TEXT'],
    ['bytes_received', 'INTEGER'],
    ['crawl_trap_flag', 'INTEGER DEFAULT 0'],
    ['crawl_trap_risk', 'REAL'],
    ['trap_type', 'TEXT'],
  ];

  for (const [col, type] of pageColumns) {
    try { db.exec(`ALTER TABLE pages ADD COLUMN ${col} ${type}`); } catch { /* already exists */ }
  }

  // Add missing columns to edges
  try { db.exec('ALTER TABLE edges ADD COLUMN weight REAL DEFAULT 1.0'); } catch { /* already exists */ }

  // Add missing columns to metrics
  const metricsColumns: [string, string][] = [
    ['pagerank_score', 'REAL'],
    ['hub_score', 'REAL'],
    ['auth_score', 'REAL'],
    ['link_role', 'TEXT'],
    ['duplicate_cluster_id', 'TEXT'],
    ['duplicate_type', 'TEXT'],
    ['cluster_id', 'INTEGER'],
    ['soft404_score', 'REAL'],
    ['heading_score', 'REAL'],
    ['orphan_type', 'TEXT'],
    ['impact_level', 'TEXT'],
  ];

  for (const [col, type] of metricsColumns) {
    try { db.exec(`ALTER TABLE metrics ADD COLUMN ${col} ${type}`); } catch { /* already exists */ }
  }
}
