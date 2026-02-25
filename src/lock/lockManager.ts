import fs from 'node:fs/promises';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import { generateLockKey } from './hashKey.js';
import { isPidAlive } from './pidCheck.js';

interface LockData {
  pid: number;
  startedAt: number;
  command: string;
  target: string;
  args: any;
}

export class LockManager {
  private static lockFilePath: string | null = null;

  private static get lockDir(): string {
    return path.join(os.homedir(), '.crawlith', 'locks');
  }

  static async acquireLock(commandName: string, targetUrl: string, options: any, force: boolean = false): Promise<void> {
    const lockHash = generateLockKey(commandName, targetUrl, options);

    // Ensure lock directory exists
    // We can use sync or async here. Since this is one-time setup, async is fine.
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
        pid = 0; // Fallback, though unused if isStale is true
      }

      if (force) {
        console.warn(chalk.yellow('Force mode enabled. Overriding existing lock.'));
        try { unlinkSync(lockPath); } catch { /* ignore */ }
      } else {
        if (!isStale) {
          console.error(chalk.red(`Crawlith: command already running for ${targetUrl} (PID ${pid})`));
          process.exit(1);
        } else {
          console.log(chalk.gray('Detected stale lock. Continuing execution.'));
          try { unlinkSync(lockPath); } catch { /* ignore */ }
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
        // Race condition: another process created lock between our check and open
        console.error(chalk.red(`Crawlith: command already running for ${targetUrl} (Race condition)`));
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

  private static registerHandlers() {
    // Ensure cleanup only happens once
    const cleanup = () => {
      this.releaseLock();
    };

    // process.on('exit') is only called when process.exit() is called or event loop empties.
    // It requires synchronous cleanup.
    process.on('exit', cleanup);

    // Signals
    process.on('SIGINT', () => {
      cleanup();
      process.exit(130);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(143);
    });
    process.on('uncaughtException', (err) => {
      console.error(chalk.red('Uncaught Exception:'), err);
      cleanup();
      process.exit(1);
    });
  }
}
