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
      soft404_score REAL,
      noindex INTEGER DEFAULT 0,
      nofollow INTEGER DEFAULT 0,
      security_error TEXT,
      retries INTEGER DEFAULT 0,
      depth INTEGER DEFAULT 0,
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
      authority_score REAL,
      hub_score REAL,
      pagerank REAL,
      crawl_status TEXT,
      word_count INTEGER,
      thin_content_score REAL,
      external_link_ratio REAL,
      orphan_score INTEGER,
      PRIMARY KEY(snapshot_id, page_id),
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_snapshot ON metrics(snapshot_id);`);
}
