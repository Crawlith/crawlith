import { Database } from 'better-sqlite3';

export interface Site {
  id: number;
  domain: string;
  preferred_url: string | null;
  ssl: number | null;
  created_at: string;
  settings_json: string | null;
  is_active: number;
}

export class SiteRepository {
  constructor(private db: Database) { }

  getSiteById(id: number): Site | undefined {
    return this.db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as Site | undefined;
  }

  getSite(domain: string): Site | undefined {
    return this.db.prepare('SELECT * FROM sites WHERE domain = ?').get(domain) as Site | undefined;
  }

  getAllSites(): Site[] {
    return this.db.prepare('SELECT * FROM sites ORDER BY domain ASC').all() as Site[];
  }

  createSite(domain: string): number {
    const stmt = this.db.prepare('INSERT INTO sites (domain) VALUES (?)');
    const info = stmt.run(domain);
    return info.lastInsertRowid as number;
  }

  updateSitePreference(id: number, prefs: { preferred_url: string; ssl: number }): void {
    const stmt = this.db.prepare('UPDATE sites SET preferred_url = ?, ssl = ? WHERE id = ?');
    stmt.run(prefs.preferred_url, prefs.ssl, id);
  }

  firstOrCreateSite(domain: string): Site {
    let site = this.getSite(domain);
    if (!site) {
      this.createSite(domain);
      site = this.getSite(domain);
    }
    return site!;
  }

  deleteSite(id: number): void {
    this.db.prepare('DELETE FROM sites WHERE id = ?').run(id);
  }
}
