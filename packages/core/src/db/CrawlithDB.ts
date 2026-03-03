import Database from 'better-sqlite3';
import { runBaseMigrations } from './migrations.js';
import { Statements } from './statements.js';
import { PluginRegistry } from './pluginRegistry.js';
import { normalizeUrl } from '../crawler/normalize.js';
import type { CrawlithPlugin } from '../plugin-system/plugin-types.js';

export class CrawlithDB {
    private db: Database.Database;
    private statements: Statements;
    private registry: PluginRegistry;

    /**
     * @internal
     * Dangerous: Returns the raw better-sqlite3 instance. 
     * Core only. Plugins must never use this.
     */
    public unsafeGetRawDb(): Database.Database {
        return this.db;
    }

    // Optional scoping properties
    private _pluginName?: string;
    private _snapshotId?: number | string;
    /** Whether live fallback is allowed (from --live flag). Core-controlled. */
    private _live: boolean = false;
    /** Whether this plugin makes network calls. Core-controlled via plugin.storage.fetchMode. */
    private _fetchMode: 'local' | 'network' = 'network';

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('mmap_size = 30000000000');
        this.db.pragma('cache_size = -20000');
        this.db.pragma('busy_timeout = 5000');

        // Integrity check on startup
        const integrity = this.db.pragma('integrity_check', { simple: true });
        if (integrity !== 'ok') {
            console.warn('Database integrity check failed:', integrity);
        }

        this.registry = new PluginRegistry();
        this.initialize();
        this.statements = new Statements(this.db);
    }

    /**
     * Schema API
     */
    public get schema() {
        return {
            define: (columns: Record<string, string>) => this.registerPluginDataSchema(columns)
        };
    }

    /**
     * Fluent Data API (URL-scoped rows)
     */
    public get data() {
        return {
            save: <T>(input: { url: string; data: T }) => this.insertPluginRow(input),

            find: <T>(url: string, options?: { maxAge?: string | number, global?: boolean }) =>
                this.getPluginRow<T>(url, undefined, undefined, options),

            all: <T>() => this.getPluginRows<T>(),

            /**
             * Cache-first with live fallback. Core-enforced pattern:
             * 1. If cached data exists → return it (always, regardless of age)
             * 2. If no cache + fetchMode='network' + live=false → return null (skip)
             * 3. If no cache + (fetchMode='local' OR live=true) → call fetchFn, save, return
             *
             * Plugin authors NEVER touch ctx.live — the core injects it via scope().
             */
            getOrFetch: <T>(url: string, fetchFn: () => Promise<T>) =>
                this._getOrFetch<T>(url, fetchFn),
        };
    }

    /**
     * Report API (Global snapshot summary)
     */
    public get report() {
        return {
            save: (summary: any, optionalScores?: {
                totalScore?: number,
                scoreCount?: number,
                scoreWeightSum?: number,
                scoreCalculatedAt?: string
            }) => this.insertPluginReport({ summary, ...optionalScores }),
            find: <T>() => this.getPluginReport() as T | null
        };
    }

    public initialize(): void {
        runBaseMigrations(this.db);
    }

    /**
     * Create a scoped instance for a specific plugin.
     * Also bakes in live + fetchMode so getOrFetch() can enforce the protocol
     * without exposing those controls to the plugin author.
     */
    public scope(
        pluginName: string,
        snapshotId?: number | string,
        options: { live?: boolean; fetchMode?: 'local' | 'network' } = {}
    ): CrawlithDB {
        if (this._pluginName && this._pluginName !== pluginName) {
            throw new Error(`Security Violation: Cannot re-scope a database instance already bound to "${this._pluginName}"`);
        }
        const scoped = Object.create(this);
        scoped._pluginName = pluginName;
        scoped._snapshotId = snapshotId;
        scoped._live = options.live ?? false;
        scoped._fetchMode = options.fetchMode ?? 'network';
        return scoped;
    }

    public registerPluginDataSchema(pluginNameOrColumns: string | Record<string, string>, extraColumns?: Record<string, string>): void {
        let pluginName = this._pluginName;
        let columns = pluginNameOrColumns as Record<string, string>;

        if (typeof pluginNameOrColumns === 'string') {
            pluginName = pluginNameOrColumns;
            columns = extraColumns!;
        }

        if (!pluginName) throw new Error('Plugin name is required for registration (use unbound DB or scope() before calling)');
        if (!columns) throw new Error('Columns definition is required');

        // Sanitize: hyphens are invalid in unquoted SQLite identifiers (e.g. "heading-health" → "heading_health_plugin")
        const tableName = this._toTableName(pluginName);

        // Validate columns
        const reserved = ['id', 'snapshot_id', 'url_id', 'score', 'weight', 'created_at'];
        for (const col of Object.keys(columns)) {
            if (reserved.includes(col.toLowerCase())) {
                throw new Error(`Plugin "${pluginName}" cannot define reserved column "${col}". Reserved: ${reserved.join(', ')}`);
            }
        }

        if (this._isMigrationExecuted(pluginName)) {
            // Even if executed, ensure the registry knows about the table name for this session
            this.registry.registerTable(tableName, pluginName);
            return;
        }

        const columnDefs = [
            'id INTEGER PRIMARY KEY AUTOINCREMENT',
            'snapshot_id INTEGER NOT NULL',
            'url_id INTEGER NOT NULL',
            ...Object.entries(columns).map(([col, type]) => `${col} ${type}`),
            "score REAL",
            "weight REAL DEFAULT 1.0",
            "created_at TEXT DEFAULT (datetime('now'))",
            'FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE',
            'FOREIGN KEY(url_id) REFERENCES pages(id) ON DELETE CASCADE'
        ];

        const migrationSQL = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
                ${columnDefs.join(',\n                ')}
            );
            CREATE INDEX IF NOT EXISTS idx_${tableName}_snapshot_url ON ${tableName}(snapshot_id, url_id);
        `;

        this.runInTransaction(() => {
            this.registry.registerTable(tableName, pluginName);
            this.db.exec(migrationSQL);
            this.statements.insertMigration.run(pluginName);
            this.registry.registerPlugin(pluginName);
        });
    }

    /** @deprecated Use registerPluginDataSchema */
    public registerPluginMigration(pluginName: string, migrationSQL: string): void {
        this.runInTransaction(() => {
            const tableMatches = migrationSQL.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi);
            for (const match of tableMatches) {
                this.registry.registerTable(match[1], pluginName);
            }
            this.db.exec(migrationSQL);
            this.statements.insertMigration.run(pluginName);
            this.registry.registerPlugin(pluginName);
        });
    }

    public getPageIdByUrl(snapshotId: number | string, url: string): number | null {
        const normalized = normalizeUrl(url, '', { stripQuery: false });
        if (!normalized) return null;

        const row = this.statements.getPageIdByUrl.get(snapshotId, normalized) as { id: number } | undefined;
        return row ? row.id : null;
    }

    public insertPluginReport(input: {
        snapshotId?: number | string;
        pluginName?: string;
        summary: unknown;
        totalScore?: number;
        scoreCount?: number;
        scoreWeightSum?: number;
        scoreCalculatedAt?: string;
    }): void {
        const snapshotId = input.snapshotId || this._snapshotId;
        const pluginName = input.pluginName || this._pluginName;

        if (!snapshotId) throw new Error('snapshotId is required (not found in input or scope)');
        if (!pluginName) throw new Error('pluginName is required (not found in input or scope)');

        this._assertSnapshotExists(snapshotId);

        const data = JSON.stringify(input.summary);
        this.statements.insertPluginReport.run(
            snapshotId,
            pluginName,
            data,
            input.totalScore ?? null,
            input.scoreCount ?? null,
            input.scoreWeightSum ?? null,
            input.scoreCalculatedAt ?? null
        );
    }

    public insertPluginRow<T>(input: {
        tableName?: string
        snapshotId?: number | string
        url: string
        data: T
    }): void {
        const tableName = input.tableName || this._pluginName;
        const snapshotId = input.snapshotId || this._snapshotId;

        if (!tableName) throw new Error('tableName/pluginName is required');
        if (!snapshotId) throw new Error('snapshotId is required');

        const resolvedTable = this._resolveTableName(tableName);
        this._assertSnapshotExists(snapshotId);
        this._assertOwnership(resolvedTable);
        this._assertTableRegistered(resolvedTable);

        const urlId = this.getPageIdByUrl(snapshotId, input.url);
        if (!urlId) {
            throw new Error(`URL "${input.url}" not found in snapshot ${snapshotId}`);
        }

        const columns = Object.keys(input.data as any);
        const placeholders = columns.map(() => '?').join(', ');
        const fields = ['snapshot_id', 'url_id', ...columns].join(', ');

        // We must use a dynamic but safe query here because T is unknown.
        // However, since we validated tableName against the registry, it's safe.
        // We still use parameters for all values.
        const stmt = this.db.prepare(`
      INSERT INTO ${resolvedTable} (${fields})
      VALUES (?, ?, ${placeholders})
    `);

        const values = Object.values(input.data as any).map(v =>
            typeof v === 'object' && v !== null ? JSON.stringify(v) : v
        );

        stmt.run(snapshotId, urlId, ...values);
    }

    public getPluginReport(snapshotId?: number | string, pluginName?: string): unknown | null {
        const sid = snapshotId || this._snapshotId;
        const name = pluginName || this._pluginName;

        if (!sid || !name) throw new Error('snapshotId and pluginName are required');

        const row = this.statements.getPluginReport.get(sid, name) as { data: string } | undefined;
        return row ? JSON.parse(row.data) : null;
    }

    public getPluginRows<T>(tableName?: string, snapshotId?: number | string): T[] {
        const targetTable = tableName || (this._pluginName ? this._toTableName(this._pluginName) : undefined);
        const sid = snapshotId || this._snapshotId;

        if (!targetTable || !sid) throw new Error('Table name and snapshotId are required');

        const resolvedTable = this._resolveTableName(targetTable);
        this._assertTableRegistered(resolvedTable);
        this._assertOwnership(resolvedTable);

        const rows = this.db.prepare(`SELECT * FROM ${resolvedTable} WHERE snapshot_id = ?`).all(sid) as any[];

        return rows.map(row => this._parseRow(row));
    }

    public getPluginRow<T>(
        tableNameOrUrl: string,
        snapshotId?: number | string,
        url?: string,
        options: { maxAge?: string | number, global?: boolean } = {}
    ): T | null {
        let targetTable = this._pluginName;
        let sid = snapshotId || this._snapshotId;
        let targetUrl = tableNameOrUrl;

        // If called with 3 args or first arg is a registered table/plugin name
        // Scoped instances MUST NOT allow overriding the target table to another plugin's table.
        if (!this._pluginName && (url || this.registry.isTableRegistered(tableNameOrUrl) || this.registry.isTableRegistered(`${tableNameOrUrl}_plugin`))) {
            targetTable = tableNameOrUrl;
            sid = snapshotId || this._snapshotId;
            targetUrl = url!;
        }

        if (!targetTable || (!sid && !options.global) || !targetUrl) {
            throw new Error(`Missing required arguments for getPluginRow: table=${targetTable}, snapshot=${sid}, url=${targetUrl}`);
        }

        const resolvedTable = this._resolveTableName(targetTable);
        this._assertTableRegistered(resolvedTable);
        this._assertOwnership(resolvedTable);

        // We use normalized URL to get the ID, but for 'global' lookup we might need to be more careful.
        // For now, we assume url_id maps to 'pages' which is snapshotted.
        // Actually, if it's 'global', we should search by actual normalized URL across snapshots.
        // Let's refine the query:

        let query = `SELECT t.* FROM ${resolvedTable} t`;
        const params: any[] = [];

        if (options.global) {
            // Join with pages to find the URL globally across all snapshots
            query += ` JOIN pages p ON t.url_id = p.id WHERE p.normalized_url = ?`;
            params.push(targetUrl);

        } else {
            const urlId = this.getPageIdByUrl(sid!, targetUrl);
            if (!urlId) return null;
            query += ` WHERE t.snapshot_id = ? AND t.url_id = ?`;
            params.push(sid, urlId);
        }

        if (options.maxAge) {
            const seconds = typeof options.maxAge === 'number' ? options.maxAge : this._parseDuration(options.maxAge);
            query += ` AND t.created_at >= datetime('now', '-${seconds} seconds')`;
        }

        query += ` ORDER BY t.id DESC LIMIT 1`;

        const row = this.db.prepare(query).get(...params) as any | undefined;
        return row ? this._parseRow(row) : null;
    }

    private _parseDuration(duration: string): number {
        const match = duration.match(/^(\d+)([hmds])$/);
        if (!match) throw new Error(`Invalid duration format: ${duration}. Use e.g. "24h", "1h", "600s"`);
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers: Record<string, number> = {
            's': 1,
            'm': 60,
            'h': 3600,
            'd': 86400
        };
        return value * multipliers[unit];
    }

    private _parseRow(row: any): any {
        const result: any = { ...row };
        for (const key in result) {
            if (typeof result[key] === 'string' && (result[key].startsWith('{') || result[key].startsWith('['))) {
                try {
                    result[key] = JSON.parse(result[key]);
                } catch {
                    // Not JSON or parse failed, keep as string
                }
            }
        }
        return result;
    }

    public deleteSnapshotPlugins(snapshotId: number | string): void {
        this.runInTransaction(() => {
            this.statements.deleteSnapshotPlugins.run(snapshotId);
            // Also cleanup registered plugin tables
            // We don't have a list of all rows in all tables, but we know the table names
            // Registered in the registry.
            // This implementation assumes plugins follow the convention of having a snapshot_id column.
        });
    }

    private async _getOrFetch<T>(url: string, fetchFn: () => Promise<T>): Promise<T | null> {
        // 1. Check cache (global across snapshots)
        const cached = this.getPluginRow<T>(url, undefined, undefined, { global: true });
        if (cached !== null) {
            return cached; // Always use cache when it exists
        }

        // 2. No cache. Can we fetch live?
        const canFetchFresh = this._fetchMode === 'local' || (this._fetchMode === 'network' && this._live);

        if (!canFetchFresh) {
            return null; // Silent skip, no data to return
        }

        // 3. Compute/Fetch fresh data
        const freshData = await fetchFn();

        // 4. Save to DB
        this.insertPluginRow({ url, data: freshData });

        return freshData;
    }

    public aggregateScoreProviders(snapshotId: number | string, plugins: CrawlithPlugin[]): void {
        this._assertSnapshotExists(snapshotId);

        for (const plugin of plugins) {
            if (!plugin.scoreProvider || !plugin.storage?.perPage?.columns) continue;

            const tableName = this._toTableName(plugin.name);
            if (!this.registry.isTableRegistered(tableName)) continue;

            try {
                // Ensure the table schema strictly conforms by ignoring plugins that might have bypassed registry constraints
                const aggregate = this.db.prepare(`
                    SELECT 
                        SUM(score * weight) as total_score,
                        SUM(weight) as score_weight_sum,
                        COUNT(score) as score_count
                    FROM ${tableName}
                    WHERE snapshot_id = ? AND score IS NOT NULL
                `).get(snapshotId) as any;

                if (!aggregate || aggregate.score_count === 0) continue;

                const { total_score, score_weight_sum, score_count } = aggregate;

                const recentReport = this.db.prepare(`
                    SELECT id FROM plugin_reports 
                    WHERE snapshot_id = ? AND plugin_name = ?
                    ORDER BY created_at DESC LIMIT 1
                `).get(snapshotId, plugin.name) as { id: number } | undefined;

                if (recentReport) {
                    this.db.prepare(`
                        UPDATE plugin_reports 
                        SET total_score = ?, score_weight_sum = ?, score_count = ?, score_calculated_at = datetime('now')
                        WHERE id = ?
                    `).run(total_score, score_weight_sum, score_count, recentReport.id);
                } else {
                    this.db.prepare(`
                        INSERT INTO plugin_reports 
                        (snapshot_id, plugin_name, data, total_score, score_weight_sum, score_count, score_calculated_at)
                        VALUES (?, ?, '{}', ?, ?, ?, datetime('now'))
                    `).run(snapshotId, plugin.name, total_score, score_weight_sum, score_count);
                }
            } catch (err) {
                console.error(`[CrawlithDB.Aggregation] Failed to aggregate scores for plugin: ${plugin.name} - ${(err as Error).message}`);
            }
        }

        try {
            // After all plugins are aggregated, tally up the snapshot-level totals
            const snapshotAggregate = this.db.prepare(`
                SELECT 
                    SUM(total_score) as overall_total_score,
                    SUM(score_weight_sum) as overall_weight_sum,
                    SUM(score_count) as overall_score_count
                FROM plugin_reports
                WHERE snapshot_id = ? AND total_score IS NOT NULL
            `).get(snapshotId) as any;

            if (snapshotAggregate && snapshotAggregate.overall_score_count > 0) {
                this.db.prepare(`
                    UPDATE snapshots
                    SET 
                        total_score = ?, 
                        score_weight_sum = ?, 
                        score_count = ?, 
                        score_calculated_at = datetime('now')
                    WHERE id = ?
                `).run(
                    snapshotAggregate.overall_total_score,
                    snapshotAggregate.overall_weight_sum,
                    snapshotAggregate.overall_score_count,
                    snapshotId
                );
            }
        } catch (err) {
            console.error(`[CrawlithDB.Aggregation] Failed to aggregate snapshot-level scores: ${(err as Error).message}`);
        }
    }

    public runInTransaction(fn: () => void): void {
        const tx = this.db.transaction(fn);
        tx();
    }

    private _resolveTableName(name: string): string {
        if (this.registry.isTableRegistered(name)) return name;
        const pluginTable = this._toTableName(name);
        if (this.registry.isTableRegistered(pluginTable)) return pluginTable;
        return name; // Will fail assertion later
    }

    /** Converts a plugin name to its canonical SQLite table name, sanitizing invalid characters. */
    private _toTableName(pluginName: string): string {
        return `${pluginName.replace(/-/g, '_')}_plugin`;
    }

    public close(): void {
        this.db.close();
    }

    private _isMigrationExecuted(pluginName: string): boolean {
        const row = this.statements.getMigration.get(pluginName);
        return !!row;
    }

    private _assertSnapshotExists(snapshotId: number | string): void {
        const row = this.statements.getSnapshot.get(snapshotId);
        if (!row) {
            throw new Error(`Snapshot ID ${snapshotId} does not exist`);
        }
    }

    private _assertTableRegistered(tableName: string): void {
        if (!this.registry.isTableRegistered(tableName)) {
            throw new Error(`Access Denied: Table "${tableName}" is not registered by any plugin migration.`);
        }
    }

    private _assertOwnership(tableName: string): void {
        if (!this._pluginName) return; // Unbound instance has full access

        const owner = this.registry.getPluginForTable(tableName);
        if (owner !== this._pluginName) {
            throw new Error(`Security Violation: Plugin "${this._pluginName}" attempted to access table "${tableName}" owned by "${owner}".`);
        }
    }
}
