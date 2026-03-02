import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { closeDb, getDb, getDbPath } from './index.js';
import { LockManager } from '../lock/lockManager.js';

export interface ResetOptions {
    reportsDir?: string;
    dryRun?: boolean;
}

/**
 * Completely resets the Crawlith state.
 * Deletes the database, clears all locks, and optionally wipes the reports directory.
 */
export async function resetCrawlith(options: ResetOptions = {}): Promise<void> {
    const { reportsDir, dryRun = false } = options;

    if (dryRun) {
        return;
    }

    // 1. Close database connection to release file handles
    closeDb();

    // 2. Clear all locks
    await LockManager.clearAllLocks();

    // 3. Remove the entire state directory (includes DB)
    const dbPath = getDbPath();
    if (dbPath !== ':memory:') {
        const crawlithDir = path.join(os.homedir(), '.crawlith');
        await fs.rm(crawlithDir, { recursive: true, force: true });
    }

    // 4. Remove reports directory if specified
    if (reportsDir) {
        const resolvedReportsDir = path.resolve(reportsDir);
        await fs.rm(resolvedReportsDir, { recursive: true, force: true });
    }

    // 5. Re-initialize database to ensure schema is fresh for next use
    getDb();
}
