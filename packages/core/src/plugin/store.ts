import { Database } from 'better-sqlite3';
import { CrawlPlugin, PluginStore } from './types.js';

export class DbPluginStore implements PluginStore {
    private hasSavedSummary = false;
    private readonly tableName: string;
    private readonly columns: Record<string, string> | null;

    constructor(
        private db: Database,
        private snapshotId: number,
        private plugin: CrawlPlugin,
        private pageIdMap: Map<string, number>
    ) {
        this.tableName = `plugin_${this.sanitizeName(this.plugin.name)}_pages`;
        this.columns = this.plugin.storage?.perPage?.columns || null;
    }

    private sanitizeName(name: string): string {
        return name.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    }

    saveSummary(data: unknown): void {
        if (this.hasSavedSummary) {
            throw new Error(`[plugin:${this.plugin.name}] Only one summary save is allowed per snapshot lifecycle.`);
        }

        const jsonData = JSON.stringify(data);

        this.db.prepare(`
            INSERT INTO plugin_reports (snapshot_id, plugin_name, data)
            VALUES (?, ?, ?)
            ON CONFLICT(snapshot_id, plugin_name) DO UPDATE SET data = excluded.data
        `).run(this.snapshotId, this.plugin.name, jsonData);

        this.hasSavedSummary = true;
    }

    loadSummary<T>(): T | null {
        const row = this.db.prepare(`
            SELECT data FROM plugin_reports 
            WHERE snapshot_id = ? AND plugin_name = ?
        `).get(this.snapshotId, this.plugin.name) as { data: string } | undefined;

        if (!row) return null;

        try {
            return JSON.parse(row.data) as T;
        } catch {
            return null;
        }
    }

    upsertPageData(url: string, data: Record<string, unknown>): void {
        if (!this.columns) {
            throw new Error(`[plugin:${this.plugin.name}] Cannot upsert page data because perPage storage was not declared in plugin definition.`);
        }

        const pageId = this.pageIdMap.get(url);
        if (!pageId) {
            return;
        }

        const keys = Object.keys(data);
        const validKeys: string[] = [];
        const values: any[] = [];

        for (const key of keys) {
            if (!(key in this.columns)) {
                throw new Error(`[plugin:${this.plugin.name}] Attempted to store undeclared column '${key}'.`);
            }
            validKeys.push(key);
            values.push(data[key]);
        }

        if (validKeys.length === 0) return;

        const colString = validKeys.join(', ');
        const paramString = validKeys.map(() => '?').join(', ');
        const updateString = validKeys.map(k => `${k} = excluded.${k}`).join(', ');

        const sql = `
            INSERT INTO ${this.tableName} (snapshot_id, page_id, ${colString})
            VALUES (?, ?, ${paramString})
            ON CONFLICT(snapshot_id, page_id) DO UPDATE SET ${updateString}
        `;

        this.db.prepare(sql).run(this.snapshotId, pageId, ...values);
    }

    getPageData<T>(url: string): T | null {
        if (!this.columns) {
            throw new Error(`[plugin:${this.plugin.name}] Cannot get page data because perPage storage was not declared.`);
        }

        const pageId = this.pageIdMap.get(url);
        if (!pageId) return null;

        const row = this.db.prepare(`
            SELECT * FROM ${this.tableName}
            WHERE snapshot_id = ? AND page_id = ?
        `).get(this.snapshotId, pageId) as T | undefined;

        return row || null;
    }
}
