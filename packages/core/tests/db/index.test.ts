import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDbPath, getDb, closeDb } from '../../src/db/index.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('node:fs');
vi.mock('node:os');
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(function () {
      return {
        pragma: vi.fn().mockReturnValue('ok'),
        prepare: vi.fn().mockReturnValue({
          run: vi.fn(),
          get: vi.fn(),
          iterate: vi.fn(),
          all: vi.fn()
        }),
        exec: vi.fn(),
        close: vi.fn(),
        transaction: vi.fn((fn) => fn),
      };
    }),
  };
});
// No longer using schema.js

describe('DB Index', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    closeDb();
    process.env = { ...originalEnv };
    // Default mock behaviors
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    closeDb();
  });

  describe('getDbPath', () => {
    it('should return :memory: in test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(getDbPath()).toBe(':memory:');
    });

    it('should return custom path if CRAWLITH_DB_PATH is set', () => {
      process.env.NODE_ENV = 'production';
      process.env.CRAWLITH_DB_PATH = '/custom/path/db.sqlite';
      expect(getDbPath()).toBe('/custom/path/db.sqlite');
    });

    it('should return default path in home dir if no env var', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CRAWLITH_DB_PATH;

      const expectedPath = path.join('/home/user', '.crawlith', 'crawlith.db');
      expect(getDbPath()).toBe(expectedPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/home/user', '.crawlith'), { recursive: true });
      expect(fs.chmodSync).toHaveBeenCalledWith(path.join('/home/user', '.crawlith'), 0o700);
    });

    it('should not create dir if it exists', () => {
      process.env.NODE_ENV = 'production';
      vi.mocked(fs.existsSync).mockReturnValue(true);

      getDbPath();

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('getDb', () => {
    it('should create a new database instance', () => {
      process.env.NODE_ENV = 'production';
      const db = getDb();
      expect(db).toBeDefined();
      // Check if pragma was called
      expect(db.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should return existing instance if called twice', () => {
      process.env.NODE_ENV = 'production';
      const db1 = getDb();
      const db2 = getDb();
      expect(db1).toBe(db2);
    });

    it('should handle permission errors gracefully', () => {
      process.env.NODE_ENV = 'production';
      // Avoid getDbPath throwing
      vi.mocked(fs.existsSync).mockReturnValue(true);

      vi.mocked(fs.chmodSync).mockImplementation((path) => {
        if (path.toString().endsWith('crawlith.db')) {
          throw new Error('EPERM');
        }
      });

      expect(() => getDb()).not.toThrow();
    });

    it('should warn if integrity check fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
      process.env.NODE_ENV = 'production';
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const MockDatabase = (await import('better-sqlite3')).default;
      vi.mocked(MockDatabase).mockImplementationOnce(function () {
        return {
          pragma: vi.fn().mockReturnValue('corrupt'),
          prepare: vi.fn(),
          exec: vi.fn(),
          close: vi.fn(),
          transaction: vi.fn(),
        } as any;
      });

      getDb();

      expect(warnSpy).toHaveBeenCalledWith('Database integrity check failed:', 'corrupt');
    });
  });
});
