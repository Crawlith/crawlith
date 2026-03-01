import type { CrawlPlugin, PluginContext, CLIWriter, ReportWriter } from './types.js';

export interface PluginManagerLogger {
  debug(message: string): void;
}

const nullLogger: PluginManagerLogger = {
  debug: () => { }
};

export class PluginManager {
  constructor(
    private readonly plugins: CrawlPlugin[],
    private readonly logger: PluginManagerLogger = nullLogger
  ) { }

  async runHook<K extends keyof CrawlPlugin>(hook: K, ...args: any[]): Promise<void> {
    for (const plugin of this.plugins) {
      const fn = plugin[hook];
      if (typeof fn !== 'function') continue;
      const started = performance.now();
      await (fn as (...a: any[]) => Promise<void>)(...args);
      const elapsed = performance.now() - started;
      this.logger.debug(`[plugin:${plugin.name}] ${String(hook)} ${elapsed.toFixed(2)}ms`);
    }
  }

  runSyncBailHook<K extends keyof CrawlPlugin>(hook: K, ...args: any[]): boolean {
    for (const plugin of this.plugins) {
      const fn = plugin[hook];
      if (typeof fn !== 'function') continue;
      const result = (fn as (...a: any[]) => boolean | void)(...args);
      if (result === false) {
        return false; // bail
      }
    }
    return true; // proceed
  }

  async init(ctx: PluginContext): Promise<void> {
    await this.runHook('onInit', ctx);
  }

  async runOnMetrics(ctx: PluginContext, cli: CLIWriter): Promise<void> {
    for (const plugin of this.plugins) {
      const fn = plugin.hooks?.onMetrics;
      if (typeof fn !== 'function') continue;

      const started = performance.now();
      try {
        await fn({ ...ctx, cli });
      } catch (err: any) {
        cli.error(`[plugin:${plugin.name}] onMetrics error: ${err.message || String(err)}`);
      }
      const elapsed = performance.now() - started;
      this.logger.debug(`[plugin:${plugin.name}] hooks.onMetrics ${elapsed.toFixed(2)}ms`);
    }
  }

  async runOnReport(ctx: PluginContext, report: ReportWriter, cli: CLIWriter): Promise<void> {
    for (const plugin of this.plugins) {
      const fn = plugin.hooks?.onReport;
      if (typeof fn !== 'function') continue;

      const started = performance.now();
      try {
        await fn({ ...ctx, report });
      } catch (err: any) {
        cli.error(`[plugin:${plugin.name}] onReport error: ${err.message || String(err)}`);
        throw err; // "Plugin attempting root mutation -> throw error / Duplicate addSection() call -> throw error"
      }
      const elapsed = performance.now() - started;
      this.logger.debug(`[plugin:${plugin.name}] hooks.onReport ${elapsed.toFixed(2)}ms`);
    }
  }
}
