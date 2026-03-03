import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { CrawlithDB } from './CrawlithDB.js';

let dbInstance: Database.Database | null = null;
let crawlithDbInstance: CrawlithDB | null = null;

export * from './repositories/SiteRepository.js';
export * from './repositories/SnapshotRepository.js';
export * from './CrawlithDB.js';
export { initSchema } from './schema.js';

export function getDbPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return ':memory:';
  }
  if (process.env.CRAWLITH_DB_PATH) {
    return process.env.CRAWLITH_DB_PATH;
  }
  const homeDir = os.homedir();
  const crawlithDir = path.join(homeDir, '.crawlith');
  if (!fs.existsSync(crawlithDir)) {
    fs.mkdirSync(crawlithDir, { recursive: true });
    // Set permissions to 700 (user only)
    fs.chmodSync(crawlithDir, 0o700);
  }
  return path.join(crawlithDir, 'crawlith.db');
}

/**
 * Returns the higher-level CrawlithDB wrapper for plugins and new code.
 */
export function getCrawlithDB(): CrawlithDB {
  if (crawlithDbInstance) {
    return crawlithDbInstance;
  }

  const dbPath = getDbPath();
  crawlithDbInstance = new CrawlithDB(dbPath);
  dbInstance = crawlithDbInstance.unsafeGetRawDb();

  // Migrations for existing tables
  try { dbInstance.exec(`ALTER TABLE pages ADD COLUMN discovered_via_sitemap INTEGER DEFAULT 0;`); } catch (_e) { /* ignore */ }

  // Security controls: Ensure file permissions are 600 (user read/write only)
  if (dbPath !== ':memory:') {
    try {
      fs.chmodSync(dbPath, 0o600);
    } catch (_e) {
      // might fail if file doesn't exist yet but better-sqlite3 should have created it
    }
  }

  return crawlithDbInstance;
}

/**
 * Returns the raw better-sqlite3 Database instance for legacy repositories.
 */
export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Initializing via getCrawlithDB ensures consistent configuration
  getCrawlithDB();
  return dbInstance!;
}

export function closeDb() {
  if (crawlithDbInstance) {
    crawlithDbInstance.close();
    crawlithDbInstance = null;
    dbInstance = null;
  } else if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
