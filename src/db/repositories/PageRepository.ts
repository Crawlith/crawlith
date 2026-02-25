import { Database } from 'better-sqlite3';

export interface Page {
  id: number;
  site_id: number;
  normalized_url: string;
  first_seen_snapshot_id: number | null;
  last_seen_snapshot_id: number | null;
  http_status: number | null;
  canonical_url: string | null;
  content_hash: string | null;
  simhash: string | null;
  etag: string | null;
  last_modified: string | null;
  html: string | null;
  soft404_score: number | null;
  noindex: number;
  nofollow: number;
  security_error: string | null;
  retries: number;
  depth: number;
  created_at: string;
  updated_at: string;
}

export class PageRepository {
  private upsertStmt;
  private getIdStmt;

  constructor(private db: Database) {
    this.upsertStmt = this.db.prepare(`
      INSERT INTO pages (
        site_id, normalized_url, first_seen_snapshot_id, last_seen_snapshot_id,
        http_status, canonical_url, content_hash, simhash, etag, last_modified, html, soft404_score, noindex, nofollow, security_error, retries, depth, updated_at
      ) VALUES (
        @site_id, @normalized_url, @first_seen_snapshot_id, @last_seen_snapshot_id,
        @http_status, @canonical_url, @content_hash, @simhash, @etag, @last_modified, @html, @soft404_score, @noindex, @nofollow, @security_error, @retries, @depth, datetime('now')
      )
      ON CONFLICT(site_id, normalized_url) DO UPDATE SET
        last_seen_snapshot_id = excluded.last_seen_snapshot_id,
        http_status = excluded.http_status,
        canonical_url = excluded.canonical_url,
        content_hash = excluded.content_hash,
        simhash = excluded.simhash,
        etag = excluded.etag,
        last_modified = excluded.last_modified,
        html = excluded.html,
        soft404_score = excluded.soft404_score,
        noindex = excluded.noindex,
        nofollow = excluded.nofollow,
        security_error = excluded.security_error,
        retries = excluded.retries,
        depth = excluded.depth,
        updated_at = datetime('now')
    `);

    this.getIdStmt = this.db.prepare('SELECT id FROM pages WHERE site_id = ? AND normalized_url = ?');
  }

  upsertPage(page: Partial<Page> & { site_id: number; normalized_url: string; last_seen_snapshot_id: number }) {
    const params = {
      site_id: page.site_id,
      normalized_url: page.normalized_url,
      first_seen_snapshot_id: page.first_seen_snapshot_id ?? page.last_seen_snapshot_id,
      last_seen_snapshot_id: page.last_seen_snapshot_id,
      http_status: page.http_status ?? null,
      canonical_url: page.canonical_url ?? null,
      content_hash: page.content_hash ?? null,
      simhash: page.simhash ?? null,
      etag: page.etag ?? null,
      last_modified: page.last_modified ?? null,
      html: page.html ?? null,
      soft404_score: page.soft404_score ?? null,
      noindex: page.noindex ?? 0,
      nofollow: page.nofollow ?? 0,
      security_error: page.security_error ?? null,
      retries: page.retries ?? 0,
      depth: page.depth ?? 0
    };

    const info = this.upsertStmt.run(params);
    if (info.changes > 0 && info.lastInsertRowid > 0) {
      // This logic is tricky. ON CONFLICT UPDATE might not set lastInsertRowid correctly in all sqlite versions or configs.
      // But better-sqlite3 usually returns the rowid if it was an INSERT.
      // If it was an UPDATE, changes might be 1, but lastInsertRowid might be old.
      // To be safe, if we can't be sure, query it.
      // However, checking if it was insert or update is hard.
      // So safest is always query ID if we need it.
      return info;
    }
    return info;
  }

  upsertAndGetId(page: Partial<Page> & { site_id: number; normalized_url: string; last_seen_snapshot_id: number }): number {
    const tx = this.db.transaction(() => {
      this.upsertPage(page);
      const row = this.getIdStmt.get(page.site_id, page.normalized_url) as { id: number } | undefined;
      if (!row) throw new Error(`Failed to retrieve ID for upserted page: ${page.normalized_url}`);
      return row.id;
    });
    return tx();
  }

  getPage(siteId: number, url: string): Page | undefined {
    return this.db.prepare('SELECT * FROM pages WHERE site_id = ? AND normalized_url = ?').get(siteId, url) as Page | undefined;
  }

  getPagesBySnapshot(snapshotId: number): Page[] {
    return this.db.prepare('SELECT * FROM pages WHERE last_seen_snapshot_id = ?').all(snapshotId) as Page[];
  }

  getIdByUrl(siteId: number, url: string): number | undefined {
    const row = this.getIdStmt.get(siteId, url) as { id: number } | undefined;
    return row?.id;
  }
}
