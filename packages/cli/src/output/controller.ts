import { CrawlEvent } from '@crawlith/core';
import chalk from '../utils/chalk.js';
import { cpus } from 'node:os';

export interface OutputOptions {
  format: 'pretty' | 'json';
  logLevel: 'normal' | 'verbose' | 'debug';
  maxPages?: number;
}

export class OutputController {
  private enqueued = 0;
  private started = 0;
  private succeeded = 0;
  private failed = 0;
  private active = 0;
  private phase = 'crawling';
  private startedAt = Date.now();
  private spinnerIndex = 0;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private lastLineLength = 0;
  private nodesFound = 0;
  private edgesFound = 0;
  private lastCpuSampleAt = Date.now();
  private lastCpuUsage = process.cpuUsage();
  private lastCpuPercent = 0;
  private readonly spinner = ['|', '/', '-', '\\'];

  constructor(private options: OutputOptions) {}

  private shouldRenderProgress(): boolean {
    return this.options.format !== 'json' && this.options.logLevel === 'normal';
  }

  private startProgress(): void {
    if (!this.shouldRenderProgress() || this.progressTimer) return;
    this.progressTimer = setInterval(() => {
      this.renderProgress();
    }, 120);
    this.progressTimer.unref?.();
  }

  private stopProgress(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.lastLineLength > 0) {
      process.stdout.write('\n');
      this.lastLineLength = 0;
    }
  }

  private formatElapsed(): string {
    const elapsedMs = Date.now() - this.startedAt;
    const sec = Math.floor(elapsedMs / 1000);
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (min > 0) return `${min}m ${remSec}s`;
    return `${remSec}s`;
  }

  private renderProgress(): void {
    if (!this.shouldRenderProgress() || !process.stdout.isTTY) return;
    const frame = this.spinner[this.spinnerIndex % this.spinner.length];
    this.spinnerIndex += 1;
    const processed = this.succeeded + this.failed;
    const configuredLimit = this.options.maxPages && this.options.maxPages > 0 ? this.options.maxPages : null;
    const target = configuredLimit ?? Math.max(this.enqueued, this.started, processed, 1);
    const processedForPct = configuredLimit ? Math.min(processed, configuredLimit) : processed;
    const queuedForDisplay = configuredLimit ? Math.min(this.enqueued, configuredLimit) : this.enqueued;
    const nodesForDisplay = configuredLimit ? Math.min(this.nodesFound, configuredLimit) : this.nodesFound;
    const pct = Math.min(100, Math.round((processedForPct / Math.max(target, 1)) * 100));
    const barWidth = 18;
    const filled = Math.max(0, Math.min(barWidth, Math.round((pct / 100) * barWidth)));
    const bar = `${'='.repeat(filled)}${'-'.repeat(barWidth - filled)}`;
    const cpu = this.sampleCpuPercent();
    const rawLine = `${frame} [${bar}] ${pct}% ok:${this.succeeded} err:${this.failed} act:${this.active} q:${queuedForDisplay} n:${nodesForDisplay} e:${this.edgesFound} cpu:${cpu.toFixed(0)}% phase:${this.phase} t:${this.formatElapsed()}`;
    const columns = process.stdout.columns || 120;
    const line = rawLine.length >= columns ? `${rawLine.slice(0, Math.max(0, columns - 2))}…` : rawLine;
    const padded = line.length < this.lastLineLength
      ? `${line}${' '.repeat(this.lastLineLength - line.length)}`
      : line;
    process.stdout.write(`\r${padded}`);
    this.lastLineLength = padded.length;
  }

  private sampleCpuPercent(): number {
    const now = Date.now();
    const elapsedMs = now - this.lastCpuSampleAt;
    if (elapsedMs <= 0) return this.lastCpuPercent;

    const usage = process.cpuUsage(this.lastCpuUsage);
    const usedMicros = usage.user + usage.system;
    const capacityMicros = elapsedMs * 1000 * Math.max(1, cpus().length);
    const pct = Math.max(0, Math.min(100, (usedMicros / Math.max(1, capacityMicros)) * 100));

    this.lastCpuSampleAt = now;
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuPercent = pct;
    return pct;
  }

  private interruptProgressLog(logFn: () => void): void {
    if (this.shouldRenderProgress() && process.stdout.isTTY && this.lastLineLength > 0) {
      process.stdout.write(`\r${' '.repeat(this.lastLineLength)}\r`);
      this.lastLineLength = 0;
    }
    logFn();
    if (this.progressTimer) {
      this.renderProgress();
    }
  }

  handle(event: CrawlEvent) {
    if (this.options.format === 'json') return;

    if (this.shouldRenderProgress()) {
      this.startProgress();
      switch (event.type) {
        case 'queue:enqueue':
          this.enqueued += 1;
          this.nodesFound = Math.max(this.nodesFound, this.enqueued);
          break;
        case 'crawl:start':
          this.started += 1;
          this.active += 1;
          break;
        case 'crawl:success':
          this.succeeded += 1;
          this.active = Math.max(0, this.active - 1);
          break;
        case 'crawl:error':
          this.failed += 1;
          this.active = Math.max(0, this.active - 1);
          break;
        case 'metrics:start':
          this.phase = event.phase;
          break;
        case 'metrics:complete':
          this.phase = 'complete';
          this.renderProgress();
          this.stopProgress();
          break;
        case 'crawl:limit-reached':
          this.phase = 'limit reached';
          break;
        case 'crawl:progress':
          this.active = Math.max(0, event.active);
          this.nodesFound = Math.max(this.nodesFound, event.nodesFound);
          this.edgesFound = Math.max(this.edgesFound, event.edgesFound);
          this.enqueued = Math.max(this.enqueued, event.nodesFound);
          if (event.phase) this.phase = event.phase;
          break;
      }
      this.renderProgress();
    }

    switch (event.type) {
      case 'crawl:start':
        if (this.options.logLevel === 'debug') {
          console.log(chalk.gray(`Starting crawl for ${event.url}`));
        } else if (this.options.logLevel === 'verbose') {
          console.log(chalk.gray(`> ${event.url}`));
        }
        break;
      case 'crawl:success':
        if (this.options.logLevel === 'debug') {
          console.log(`${chalk.gray(`[D:${event.depth}]`)} ${event.status} ${chalk.blue(event.url)} (${event.durationMs}ms)`);
        } else if (this.options.logLevel === 'verbose') {
          console.log(`${chalk.green(event.status)} ${event.url}`);
        }
        break;
      case 'crawl:error':
        this.interruptProgressLog(() => {
          console.error(chalk.red(`Error processing ${event.url}: ${event.error}`));
        });
        break;
      case 'queue:enqueue':
        if (this.options.logLevel === 'debug') {
           console.log(chalk.gray(`Enqueued ${event.url} (depth ${event.depth})`));
        }
        break;
      case 'metrics:start':
        if (this.options.logLevel !== 'normal') {
           console.log(chalk.blue(`Use metrics: ${event.phase}...`));
        }
        break;
      case 'metrics:complete':
        if (this.options.logLevel !== 'normal') {
           console.log(chalk.green('Metrics calculation complete.'));
        }
        break;
      case 'info':
        this.interruptProgressLog(() => {
          console.log(chalk.blue(event.message));
        });
        break;
      case 'warn':
        this.interruptProgressLog(() => {
          console.warn(chalk.yellow(event.message));
        });
        break;
      case 'error':
        this.interruptProgressLog(() => {
          console.error(chalk.red(event.message));
          if (event.error && this.options.logLevel === 'debug') {
            console.error(event.error);
          }
        });
        break;
      case 'debug':
        if (this.options.logLevel === 'debug') {
            console.log(chalk.gray(`[DEBUG] ${event.message}`), event.context || '');
        }
        break;
      case 'crawl:limit-reached':
        this.interruptProgressLog(() => {
          console.log(chalk.yellow(`Crawl limit of ${event.limit} pages reached.`));
        });
        break;
      case 'crawl:progress':
        break;
    }
  }

  renderResult<T>(result: T, prettyRenderer?: (result: T) => string) {
    this.stopProgress();

    if (this.options.format === 'json') {
      process.stdout.write(JSON.stringify(result, null, 2));
      return;
    }

    if (prettyRenderer) {
      console.log(prettyRenderer(result));
    }
  }

  finish(): void {
    this.stopProgress();
  }
}
