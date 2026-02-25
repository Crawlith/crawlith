import { Database } from 'better-sqlite3';

export interface Site {
  id: number;
  domain: string;
  created_at: string;
  settings_json: string | null;
  is_active: number;
}

export class SiteRepository {
  constructor(private db: Database) {}

  getSite(domain: string): Site | undefined {
    return this.db.prepare('SELECT * FROM sites WHERE domain = ?').get(domain) as Site | undefined;
  }

  createSite(domain: string): number {
    const stmt = this.db.prepare('INSERT INTO sites (domain) VALUES (?)');
    const info = stmt.run(domain);
    return info.lastInsertRowid as number;
  }
}
