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
  noindex: number;
  nofollow: number;
  security_error: string | null;
  retries: number;
  depth: number;
  discovered_via_sitemap: number;
  redirect_chain: string | null;
  bytes_received: number | null;
  crawl_trap_flag: number;
  crawl_trap_risk: number | null;
  trap_type: string | null;
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
        http_status, canonical_url, content_hash, simhash, etag, last_modified, html,
        noindex, nofollow, security_error, retries, depth,
        discovered_via_sitemap, redirect_chain, bytes_received, crawl_trap_flag, crawl_trap_risk, trap_type,
        updated_at
      ) VALUES (
        @site_id, @normalized_url, @first_seen_snapshot_id, @last_seen_snapshot_id,
        @http_status, @canonical_url, @content_hash, @simhash, @etag, @last_modified, @html,
        @noindex, @nofollow, @security_error, @retries, @depth,
        @discovered_via_sitemap, @redirect_chain, @bytes_received, @crawl_trap_flag, @crawl_trap_risk, @trap_type,
        datetime('now')
      )
      ON CONFLICT(site_id, normalized_url) DO UPDATE SET
        last_seen_snapshot_id = excluded.last_seen_snapshot_id,
        http_status = CASE WHEN excluded.http_status != 0 THEN excluded.http_status ELSE pages.http_status END,
        canonical_url = COALESCE(excluded.canonical_url, pages.canonical_url),
        content_hash = COALESCE(excluded.content_hash, pages.content_hash),
        simhash = COALESCE(excluded.simhash, pages.simhash),
        etag = COALESCE(excluded.etag, pages.etag),
        last_modified = COALESCE(excluded.last_modified, pages.last_modified),
        html = COALESCE(excluded.html, pages.html),
        noindex = CASE WHEN excluded.http_status != 0 THEN excluded.noindex ELSE pages.noindex END,
        nofollow = CASE WHEN excluded.http_status != 0 THEN excluded.nofollow ELSE pages.nofollow END,
        security_error = COALESCE(excluded.security_error, pages.security_error),
        retries = MAX(pages.retries, excluded.retries),
        depth = MIN(pages.depth, excluded.depth),
        discovered_via_sitemap = MAX(pages.discovered_via_sitemap, excluded.discovered_via_sitemap),
        redirect_chain = COALESCE(excluded.redirect_chain, pages.redirect_chain),
        bytes_received = COALESCE(excluded.bytes_received, pages.bytes_received),
        crawl_trap_flag = MAX(pages.crawl_trap_flag, excluded.crawl_trap_flag),
        crawl_trap_risk = COALESCE(excluded.crawl_trap_risk, pages.crawl_trap_risk),
        trap_type = COALESCE(excluded.trap_type, pages.trap_type),
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
      noindex: page.noindex ?? 0,
      nofollow: page.nofollow ?? 0,
      security_error: page.security_error ?? null,
      retries: page.retries ?? 0,
      depth: page.depth ?? 0,
      discovered_via_sitemap: page.discovered_via_sitemap ?? 0,
      redirect_chain: page.redirect_chain ?? null,
      bytes_received: page.bytes_received ?? null,
      crawl_trap_flag: page.crawl_trap_flag ?? 0,
      crawl_trap_risk: page.crawl_trap_risk ?? null,
      trap_type: page.trap_type ?? null,
    };

    const info = this.upsertStmt.run(params);
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

  getPagesByUrls(siteId: number, urls: string[]): Page[] {
    if (urls.length === 0) return [];
    const chunkSize = 900;
    const results: Page[] = [];

    for (let i = 0; i < urls.length; i += chunkSize) {
      const chunk = urls.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const chunkResults = this.db.prepare(`SELECT * FROM pages WHERE site_id = ? AND normalized_url IN (${placeholders})`).all(siteId, ...chunk) as Page[];
      results.push(...chunkResults);
    }

    return results;
  }

  upsertMany(pages: (Partial<Page> & { site_id: number; normalized_url: string; last_seen_snapshot_id: number })[]): Map<string, number> {
    if (pages.length === 0) return new Map();

    const upsertStmtWithReturn = this.db.prepare(`
      INSERT INTO pages (
        site_id, normalized_url, first_seen_snapshot_id, last_seen_snapshot_id,
        http_status, canonical_url, content_hash, simhash, etag, last_modified, html,
        noindex, nofollow, security_error, retries, depth,
        discovered_via_sitemap, redirect_chain, bytes_received, crawl_trap_flag, crawl_trap_risk, trap_type,
        updated_at
      ) VALUES (
        @site_id, @normalized_url, @first_seen_snapshot_id, @last_seen_snapshot_id,
        @http_status, @canonical_url, @content_hash, @simhash, @etag, @last_modified, @html,
        @noindex, @nofollow, @security_error, @retries, @depth,
        @discovered_via_sitemap, @redirect_chain, @bytes_received, @crawl_trap_flag, @crawl_trap_risk, @trap_type,
        datetime('now')
      )
      ON CONFLICT(site_id, normalized_url) DO UPDATE SET
        last_seen_snapshot_id = excluded.last_seen_snapshot_id,
        http_status = CASE WHEN excluded.http_status != 0 THEN excluded.http_status ELSE pages.http_status END,
        canonical_url = COALESCE(excluded.canonical_url, pages.canonical_url),
        content_hash = COALESCE(excluded.content_hash, pages.content_hash),
        simhash = COALESCE(excluded.simhash, pages.simhash),
        etag = COALESCE(excluded.etag, pages.etag),
        last_modified = COALESCE(excluded.last_modified, pages.last_modified),
        html = COALESCE(excluded.html, pages.html),
        noindex = CASE WHEN excluded.http_status != 0 THEN excluded.noindex ELSE pages.noindex END,
        nofollow = CASE WHEN excluded.http_status != 0 THEN excluded.nofollow ELSE pages.nofollow END,
        security_error = COALESCE(excluded.security_error, pages.security_error),
        retries = MAX(pages.retries, excluded.retries),
        depth = MIN(pages.depth, excluded.depth),
        discovered_via_sitemap = MAX(pages.discovered_via_sitemap, excluded.discovered_via_sitemap),
        redirect_chain = COALESCE(excluded.redirect_chain, pages.redirect_chain),
        bytes_received = COALESCE(excluded.bytes_received, pages.bytes_received),
        crawl_trap_flag = MAX(pages.crawl_trap_flag, excluded.crawl_trap_flag),
        crawl_trap_risk = COALESCE(excluded.crawl_trap_risk, pages.crawl_trap_risk),
        trap_type = COALESCE(excluded.trap_type, pages.trap_type),
        updated_at = datetime('now')
      RETURNING id
    `);

    const urlToId = new Map<string, number>();
    const tx = this.db.transaction((pagesBatch) => {
      for (const page of pagesBatch) {
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
          noindex: page.noindex ?? 0,
          nofollow: page.nofollow ?? 0,
          security_error: page.security_error ?? null,
          retries: page.retries ?? 0,
          depth: page.depth ?? 0,
          discovered_via_sitemap: page.discovered_via_sitemap ?? 0,
          redirect_chain: page.redirect_chain ?? null,
          bytes_received: page.bytes_received ?? null,
          crawl_trap_flag: page.crawl_trap_flag ?? 0,
          crawl_trap_risk: page.crawl_trap_risk ?? null,
          trap_type: page.trap_type ?? null,
        };
        const row = upsertStmtWithReturn.get(params) as { id: number };
        urlToId.set(page.normalized_url, row.id);
      }
    });

    tx(pages);
    return urlToId;
  }

  getPagesBySnapshot(snapshotId: number): Page[] {
    return this.db.prepare('SELECT p.* FROM pages p JOIN snapshots s ON p.site_id = s.site_id WHERE s.id = ? AND p.first_seen_snapshot_id <= ?').all(snapshotId, snapshotId) as Page[];
  }

  getPagesIdentityBySnapshot(snapshotId: number): { id: number; normalized_url: string }[] {
    return this.db.prepare('SELECT p.id, p.normalized_url FROM pages p JOIN snapshots s ON p.site_id = s.site_id WHERE s.id = ? AND p.first_seen_snapshot_id <= ?').all(snapshotId, snapshotId) as { id: number; normalized_url: string }[];
  }

  getPagesIteratorBySnapshot(snapshotId: number): IterableIterator<Page> {
    return this.db.prepare('SELECT p.* FROM pages p JOIN snapshots s ON p.site_id = s.site_id WHERE s.id = ? AND p.first_seen_snapshot_id <= ?').iterate(snapshotId, snapshotId) as IterableIterator<Page>;
  }

  getIdByUrl(siteId: number, url: string): number | undefined {
    const row = this.getIdStmt.get(siteId, url) as { id: number } | undefined;
    return row?.id;
  }
}
