import type { CrawlPlugin, PluginContext } from './types.js';

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
}
