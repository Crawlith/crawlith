import type { CrawlPlugin, PluginContext, CLIWriter, ReportWriter } from './types.js';
import { getDb } from '../db/index.js';
import { DbPluginStore } from './store.js';

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
      // console.log(`[PluginManager] Running hook ${String(hook)} for plugin ${plugin.name}`);
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
    const db = getDb();

    // Idempotent schema creation for plugins declaring perPage storage
    for (const plugin of this.plugins) {
      const perPage = plugin.storage?.perPage;
      if (perPage && perPage.columns) {
        const sanitizedName = plugin.name.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        const tableName = `plugin_${sanitizedName}_pages`;

        const columnDefs = Object.entries(perPage.columns)
          .map(([colName, type]) => `${colName} ${type}`)
          .join(',\n            ');

        const ddl = `
          CREATE TABLE IF NOT EXISTS ${tableName} (
            snapshot_id INTEGER NOT NULL,
            page_id INTEGER NOT NULL,
            ${columnDefs},
            PRIMARY KEY (snapshot_id, page_id),
            FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
          );
        `;

        try {
          db.exec(ddl);
          db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_snapshot_page ON ${tableName}(snapshot_id, page_id);`);
        } catch (err: any) {
          this.logger.debug(`[plugin:${plugin.name}] Failed to auto-create schema: ${err.message || String(err)}`);
        }
      }
    }

    await this.runHook('onInit', ctx);
  }

  private getPageIdMap(snapshotId?: number): Map<string, number> {
    const db = getDb();
    const map = new Map<string, number>();
    if (!snapshotId) return map;

    try {
      const rows = db.prepare('SELECT p.id, p.normalized_url FROM pages p JOIN snapshots s ON p.site_id = s.site_id WHERE s.id = ? AND p.first_seen_snapshot_id <= ?').all(snapshotId, snapshotId) as { id: number; normalized_url: string }[];
      for (const row of rows) {
        map.set(row.normalized_url, row.id);
      }
    } catch (err: any) {
      this.logger.debug(`Failed to fetch page IDs: ${err.message || String(err)}`);
    }
    return map;
  }

  async runOnMetrics(ctx: PluginContext & { snapshotId?: number }, cli: CLIWriter): Promise<void> {
    const db = getDb();
    const pageIdMap = this.getPageIdMap(ctx.snapshotId);

    for (const plugin of this.plugins) {
      const fn = plugin.hooks?.onMetrics;
      if (typeof fn !== 'function') continue;

      const store = new DbPluginStore(db, ctx.snapshotId || 0, plugin, pageIdMap);

      const started = performance.now();
      try {
        await fn({ ...ctx, cli, store });
      } catch (err: any) {
        cli.error(`[plugin:${plugin.name}] onMetrics error: ${err.message || String(err)}`);
      }
      const elapsed = performance.now() - started;
      this.logger.debug(`[plugin:${plugin.name}] hooks.onMetrics ${elapsed.toFixed(2)}ms`);
    }
  }

  async runOnReport(ctx: PluginContext & { snapshotId?: number }, report: ReportWriter, cli: CLIWriter): Promise<void> {
    const db = getDb();
    const pageIdMap = this.getPageIdMap(ctx.snapshotId);

    for (const plugin of this.plugins) {
      const fn = plugin.hooks?.onReport;
      if (typeof fn !== 'function') continue;

      const store = new DbPluginStore(db, ctx.snapshotId || 0, plugin, pageIdMap);

      const started = performance.now();
      try {
        await fn({ ...ctx, report, cli, store });
      } catch (err: any) {
        cli.error(`[plugin:${plugin.name}] onReport error: ${err.message || String(err)}`);
        throw err; // "Plugin attempting root mutation -> throw error / Duplicate addSection() call -> throw error"
      }
      const elapsed = performance.now() - started;
      this.logger.debug(`[plugin:${plugin.name}] hooks.onReport ${elapsed.toFixed(2)}ms`);
    }
  }
}
