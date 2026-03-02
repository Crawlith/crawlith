import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LockManager } from '../../src/lock/lockManager.js';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('node:fs');
vi.mock('node:os');

describe('LockManager.clearAllLocks', () => {
    const mockHomeDir = '/home/user';
    const lockDir = path.join(mockHomeDir, '.crawlith', 'locks');

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
        vi.mocked(fs.readdir).mockResolvedValue(['a.lock', 'b.lock', 'other.txt'] as any);
        vi.mocked(fs.unlink).mockResolvedValue(undefined);
        vi.mocked(existsSync).mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should delete all lock files and return the count', async () => {
        const count = await LockManager.clearAllLocks();

        expect(count).toBe(2);
        expect(fs.readdir).toHaveBeenCalledWith(lockDir);
        expect(fs.unlink).toHaveBeenCalledWith(path.join(lockDir, 'a.lock'));
        expect(fs.unlink).toHaveBeenCalledWith(path.join(lockDir, 'b.lock'));
        expect(fs.unlink).not.toHaveBeenCalledWith(path.join(lockDir, 'other.txt'));
    });

    it('should return 0 if lock directory does not exist', async () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const count = await LockManager.clearAllLocks();

        expect(count).toBe(0);
        expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('should ignore errors during individual file deletions', async () => {
        vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('EPERM'));

        const count = await LockManager.clearAllLocks();

        expect(count).toBe(1);
        expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
});
