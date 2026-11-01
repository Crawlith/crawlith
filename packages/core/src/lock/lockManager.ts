import fs from 'node:fs/promises';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateLockKey } from './hashKey.js';
import { isPidAlive } from './pidCheck.js';
import { EngineContext } from '../events.js';

export interface LockData {
  pid: number;
  startedAt: number;
  command: string;
  target: string;
  args: any;
}

export class LockManager {
  private static lockFilePath: string | null = null;
  private static context: EngineContext | null = null;

  private static get lockDir(): string {
    return path.join(os.homedir(), '.crawlith', 'locks');
  }

  static async acquireLock(commandName: string, targetUrl: string, options: any, context?: EngineContext, force: boolean = false): Promise<void> {
    this.context = context || null;
    const lockHash = generateLockKey(commandName, targetUrl, options);

    // Ensure lock directory exists
    await fs.mkdir(this.lockDir, { recursive: true });

    const lockPath = path.join(this.lockDir, `${lockHash}.lock`);

    // Check existing lock
    if (existsSync(lockPath)) {
      let isStale: boolean;
      let pid: number;

      try {
        const lockContent = readFileSync(lockPath, 'utf-8');
        const lockData = JSON.parse(lockContent);
        pid = lockData.pid;
        isStale = !isPidAlive(pid);
      } catch (_e) {
        // Corrupted -> Treat as stale
        isStale = true;
        pid = 0;
      }

      if (force) {
        this.log('warn', 'Force mode enabled. Overriding existing lock.');
        this.removeLockFile(lockPath);
      } else {
        if (!isStale) {
          this.log('error', `Crawlith: command already running for ${targetUrl} (PID ${pid})`);
          process.exit(1);
        } else {
          this.log('info', 'Detected stale lock. Continuing execution.');
          this.removeLockFile(lockPath);
        }
      }
    }

    // Create new lock
    try {
      const data: LockData = {
        pid: process.pid,
        startedAt: Date.now(),
        command: commandName,
        target: targetUrl,
        args: options
      };

      // 'wx' flag ensures atomic creation, failing if file exists
      await fs.writeFile(lockPath, JSON.stringify(data, null, 2), { flag: 'wx', encoding: 'utf-8' });

      this.lockFilePath = lockPath;
      this.registerHandlers();
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        this.log('error', `Crawlith: command already running for ${targetUrl} (Race condition)`);
        process.exit(1);
      }
      throw error;
    }
  }

  static releaseLock(): void {
    if (this.lockFilePath && existsSync(this.lockFilePath)) {
      try {
        unlinkSync(this.lockFilePath);
        this.lockFilePath = null;
      } catch (_error) {
        // Ignore errors during cleanup
      }
    }
  }
  /** Locks whose owning process is still running. Corrupt lock files count as stale. */
  static async findLiveLocks(): Promise<LockData[]> {
    const live: LockData[] = [];
    for (const file of await this.lockFiles()) {
      const lock = await this.readLock(file);
      if (lock && isPidAlive(lock.pid)) live.push(lock);
    }
    return live;
  }

  /** Deletes stale lock files and returns how many were removed. Locks held by running processes are kept. */
  static async clearAllLocks(): Promise<number> {
    let count = 0;
    for (const file of await this.lockFiles()) {
      const lock = await this.readLock(file);
      if (lock && isPidAlive(lock.pid)) continue;
      try {
        await fs.unlink(file);
        count++;
      } catch { /* already gone or not removable; nothing to clear */ }
    }
    return count;
  }

  private static async lockFiles(): Promise<string[]> {
    if (!existsSync(this.lockDir)) return [];
    const files = await fs.readdir(this.lockDir);
    return files.filter(f => f.endsWith('.lock')).map(f => path.join(this.lockDir, f));
  }

  private static async readLock(file: string): Promise<LockData | null> {
    try {
      return JSON.parse(await fs.readFile(file, 'utf-8')) as LockData;
    } catch {
      return null;
    }
  }

  /**
   * Removes a stale or overridden lock. A file that is already gone is fine; any other failure is reported,
   * because the exclusive create that follows would otherwise fail and be misreported as a race.
   */
  private static removeLockFile(lockPath: string): void {
    try {
      unlinkSync(lockPath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return;
      throw new Error(`Cannot remove stale lock ${lockPath}: ${error?.message ?? error}`, { cause: error });
    }
  }

  private static log(type: 'info' | 'warn' | 'error', message: string, error?: unknown) {
    if (this.context) {
      this.context.emit({ type, message, error });
    } else {
      // Fallback for legacy usage or when no context provided
      if (type === 'error') console.error(message, error || '');
      else if (type === 'warn') console.warn(message);
      else console.log(message);
    }
  }

  private static registerHandlers() {
    // Ensure cleanup only happens once
    const cleanup = () => {
      this.releaseLock();
    };

    process.on('exit', cleanup);

    process.on('SIGINT', () => {
      cleanup();
      process.exit(130);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(143);
    });
    process.on('uncaughtException', (err) => {
      this.log('error', 'Uncaught Exception', err);
      cleanup();
      process.exit(1);
    });
  }
}
