import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetCrawlith } from '../src/db/reset.js';
import * as dbIndex from '../src/db/index.js';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('node:fs');
vi.mock('node:os');
vi.mock('../src/db/index.js', async () => {
    const actual = await vi.importActual('../src/db/index.js') as any;
    return {
        ...actual,
        getDb: vi.fn(),
        closeDb: vi.fn(),
        getDbPath: vi.fn()
    };
});

describe('resetCrawlith', () => {
    const mockHomeDir = '/home/user';
    const crawlithDir = path.join(mockHomeDir, '.crawlith');
    const reportsDir = './crawlith-reports';

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
        vi.mocked(dbIndex.getDbPath).mockReturnValue(path.join(crawlithDir, 'crawlith.db'));
        vi.mocked(fs.rm).mockResolvedValue(undefined);
        vi.mocked(fs.readdir).mockResolvedValue([] as any);
        vi.mocked(existsSync).mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should clear locks, wipe state directory, wipe reports, and re-init db', async () => {
        // Mock locks
        vi.mocked(fs.readdir).mockResolvedValue(['a.lock', 'b.lock', 'other.txt'] as any);
        vi.mocked(fs.unlink).mockResolvedValue(undefined);

        await resetCrawlith({ reportsDir });

        // 1. Database should be closed
        expect(dbIndex.closeDb).toHaveBeenCalled();

        // 2. Locks should be cleared
        // Lock directory is at ~/.crawlith/locks
        const expectedLockDir = path.join(crawlithDir, 'locks');
        expect(fs.readdir).toHaveBeenCalledWith(expectedLockDir);
        expect(fs.unlink).toHaveBeenCalledWith(path.join(expectedLockDir, 'a.lock'));
        expect(fs.unlink).toHaveBeenCalledWith(path.join(expectedLockDir, 'b.lock'));
        expect(fs.unlink).not.toHaveBeenCalledWith(path.join(expectedLockDir, 'other.txt'));

        // 3. State directory should be removed
        expect(fs.rm).toHaveBeenCalledWith(crawlithDir, expect.objectContaining({ recursive: true, force: true }));

        // 4. Reports directory should be removed
        expect(fs.rm).toHaveBeenCalledWith(path.resolve(reportsDir), expect.objectContaining({ recursive: true, force: true }));

        // 5. Database should be re-initialized
        expect(dbIndex.getDb).toHaveBeenCalled();
    });

    it('should not delete state directory if db is in-memory', async () => {
        vi.mocked(dbIndex.getDbPath).mockReturnValue(':memory:');

        await resetCrawlith({ reportsDir });

        expect(fs.rm).not.toHaveBeenCalledWith(crawlithDir, expect.anything());
        expect(fs.rm).toHaveBeenCalledWith(path.resolve(reportsDir), expect.anything());
    });

    it('should skip reset if dryRun is true', async () => {
        await resetCrawlith({ dryRun: true });

        expect(dbIndex.closeDb).not.toHaveBeenCalled();
        expect(fs.rm).not.toHaveBeenCalled();
        expect(dbIndex.getDb).not.toHaveBeenCalled();
    });
});
