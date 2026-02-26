import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LockManager } from '../../src/lock/lockManager.js';
import { generateLockKey } from '../../src/lock/hashKey.js';
import fs from 'node:fs/promises';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isPidAlive } from '../../src/lock/pidCheck.js';

// Mock fs and os
vi.mock('node:fs/promises');
vi.mock('node:fs');
vi.mock('node:os');
vi.mock('../../src/lock/pidCheck.js', () => ({
  isPidAlive: vi.fn()
}));

describe('LockManager', () => {
  const mockHomeDir = '/home/user';
  const lockDir = path.join(mockHomeDir, '.crawlith', 'locks');
  const command = 'test-command';
  const target = 'http://example.com';
  const options = { limit: 10 };
  const lockHash = generateLockKey(command, target, options);
  const lockPath = path.join(lockDir, `${lockHash}.lock`);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('{}');
    vi.mocked(unlinkSync).mockReturnValue(undefined);

    // Mock process.pid
    Object.defineProperty(process, 'pid', { value: 12345, configurable: true });

    // Mock process.exit to throw error to stop execution flow in tests
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exit ${code}`);
    });

    // Mock console to suppress noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset static state if any (LockManager stores lockFilePath)
    LockManager.releaseLock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should acquire lock when no lock exists', async () => {
    await LockManager.acquireLock(command, target, options);

    expect(fs.mkdir).toHaveBeenCalledWith(lockDir, { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      lockPath,
      expect.stringContaining('"limit": 10'),
      expect.objectContaining({ flag: 'wx' })
    );
  });

  it('should fail if lock exists and PID is alive', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      pid: 9999,
      startedAt: Date.now(),
      command,
      target,
      args: options
    }));
    vi.mocked(isPidAlive).mockReturnValue(true);

    await expect(LockManager.acquireLock(command, target, options)).rejects.toThrow('Process exit 1');

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('already running'));
  });

  it('should clear stale lock and acquire if PID is dead', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      pid: 9999,
      startedAt: Date.now(),
      command,
      target,
      args: options
    }));
    vi.mocked(isPidAlive).mockReturnValue(false);

    await LockManager.acquireLock(command, target, options);

    expect(unlinkSync).toHaveBeenCalledWith(lockPath);
    expect(fs.writeFile).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Detected stale lock'));
  });

  it('should override lock if force is true', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    // Even if PID is alive
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      pid: 9999
    }));
    vi.mocked(isPidAlive).mockReturnValue(true);

    await LockManager.acquireLock(command, target, options, true); // force = true

    expect(unlinkSync).toHaveBeenCalledWith(lockPath);
    expect(fs.writeFile).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Force mode enabled'));
  });

  it('should handle race condition (EEXIST)', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(fs.writeFile).mockRejectedValue({ code: 'EEXIST' });

    await expect(LockManager.acquireLock(command, target, options)).rejects.toThrow('Process exit 1');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Race condition'));
  });

  it('should release lock on exit', async () => {
    // Acquire first (existsSync returns false by default from beforeEach)
    await LockManager.acquireLock(command, target, options);

    // Simulate file exists for release
    vi.mocked(existsSync).mockReturnValue(true);

    // Simulate release
    LockManager.releaseLock();

    expect(unlinkSync).toHaveBeenCalledWith(lockPath);
  });

  it('should register signal handlers and cleanup on SIGINT', async () => {
    const processOnSpy = vi.spyOn(process, 'on');
    await LockManager.acquireLock(command, target, options);

    // Find the handler
    const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
    expect(sigintCall).toBeDefined();
    const handler = sigintCall![1] as () => void;

    // Trigger handler
    vi.mocked(existsSync).mockReturnValue(true); // Simulate file still exists
    try {
      handler();
    } catch (e: any) {
       // Expect process.exit(130) which throws error in our mock
       expect(e.message).toBe('Process exit 130');
    }

    expect(unlinkSync).toHaveBeenCalledWith(lockPath);
  });

  it('should register signal handlers and cleanup on SIGTERM', async () => {
    const processOnSpy = vi.spyOn(process, 'on');
    await LockManager.acquireLock(command, target, options);

    // Find the handler
    const sigtermCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGTERM');
    expect(sigtermCall).toBeDefined();
    const handler = sigtermCall![1] as () => void;

    // Trigger handler
    vi.mocked(existsSync).mockReturnValue(true);
    try {
      handler();
    } catch (e: any) {
       expect(e.message).toBe('Process exit 143');
    }

    expect(unlinkSync).toHaveBeenCalledWith(lockPath);
  });

  it('should register signal handlers and cleanup on uncaughtException', async () => {
      const processOnSpy = vi.spyOn(process, 'on');
      await LockManager.acquireLock(command, target, options);

      // Find the handler
      const uncaughtExceptionCall = processOnSpy.mock.calls.find(call => call[0] === 'uncaughtException');
      expect(uncaughtExceptionCall).toBeDefined();
      const handler = uncaughtExceptionCall![1] as (err: Error) => void;

      // Trigger handler
      vi.mocked(existsSync).mockReturnValue(true);
      try {
        handler(new Error('Test error'));
      } catch (e: any) {
         expect(e.message).toBe('Process exit 1');
      }

      expect(unlinkSync).toHaveBeenCalledWith(lockPath);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Uncaught Exception'), expect.any(Error));
    });
});
