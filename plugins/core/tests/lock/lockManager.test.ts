import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LockManager } from '../../src/lock/lockManager.js';
import { generateLockKey } from '../../src/lock/hashKey.js';
import fs from 'node:fs/promises';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isPidAlive } from '../../src/lock/pidCheck.js';
import { EngineContext } from '../../src/events.js';

// Mock fs and os
vi.mock('node:fs/promises');
vi.mock('node:fs');
vi.mock('node:os');
vi.mock('../../src/lock/pidCheck.js', () => ({
  isPidAlive: vi.fn()
}));

const mockContext: EngineContext = { emit: vi.fn() };

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset static state
    LockManager.releaseLock();
  });

  it('should acquire lock when no lock exists', async () => {
    await LockManager.acquireLock(command, target, options, mockContext);

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

    await expect(LockManager.acquireLock(command, target, options, mockContext)).rejects.toThrow('Process exit 1');

    expect(mockContext.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message: expect.stringContaining('already running') }));
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

    await LockManager.acquireLock(command, target, options, mockContext);

    expect(unlinkSync).toHaveBeenCalledWith(lockPath);
    expect(fs.writeFile).toHaveBeenCalled();
    expect(mockContext.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'info', message: expect.stringContaining('Detected stale lock') }));
  });

  it('should override lock if force is true', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    // Even if PID is alive
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      pid: 9999
    }));
    vi.mocked(isPidAlive).mockReturnValue(true);

    await LockManager.acquireLock(command, target, options, mockContext, true); // force = true

    expect(unlinkSync).toHaveBeenCalledWith(lockPath);
    expect(fs.writeFile).toHaveBeenCalled();
    expect(mockContext.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'warn', message: expect.stringContaining('Force mode enabled') }));
  });

  it('should handle race condition (EEXIST)', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(fs.writeFile).mockRejectedValue({ code: 'EEXIST' });

    await expect(LockManager.acquireLock(command, target, options, mockContext)).rejects.toThrow('Process exit 1');
    expect(mockContext.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message: expect.stringContaining('Race condition') }));
  });

  it('should release lock on exit', async () => {
    // Acquire first (existsSync returns false by default from beforeEach)
    await LockManager.acquireLock(command, target, options, mockContext);

    // Simulate file exists for release
    vi.mocked(existsSync).mockReturnValue(true);

    // Simulate release
    LockManager.releaseLock();

    expect(unlinkSync).toHaveBeenCalledWith(lockPath);
  });
});
