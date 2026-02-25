import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { initSchema } from './schema.js';

let dbInstance: Database.Database | null = null;

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

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  const db = new Database(dbPath);

  // Hardening & Performance Configuration
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 30000000000');
  db.pragma('cache_size = -20000');
  db.pragma('busy_timeout = 5000');

  // Security controls
  // Ensure file permissions are 600 (user read/write only)
  try {
    fs.chmodSync(dbPath, 0o600);
  } catch (_e) {
    // might fail on first creation if file doesn't exist yet, but better-sqlite3 creates it
    // so we can try again or ignore if it's new
  }

  // Integrity check on startup
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    console.warn('Database integrity check failed:', integrity);
  }

  // Initialize schema
  initSchema(db);

  dbInstance = db;
  return db;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
