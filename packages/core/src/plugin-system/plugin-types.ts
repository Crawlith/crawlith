import type { CrawlithDB } from '../db/CrawlithDB.js';

// ─── Scope ───────────────────────────────────────────────────────────────────

/**
 * Execution scope — set by the core before any hooks run.
 * - `page`  → single-URL analysis (crawlith page …)
 * - `crawl` → full site crawl   (crawlith crawl …)
 */
export type PluginScope = 'page' | 'crawl';

// ─── Output writers ───────────────────────────────────────────────────────────

/** Injected into hook contexts to let plugins emit structured CLI output. */
export interface CLIWriter {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
}

/**
 * Injected into report-phase hook contexts.
 * Plugins contribute structured data that the core aggregates into the final output.
 */
export interface ReportWriter {
    /** Attach a named data section to the report output. */
    addSection(pluginName: string, data: unknown): void;
    /** Optionally contribute a weighted score component. */
    contributeScore?(input: { label: string; score: number; weight: number }): void;
}

// ─── Per-page input ───────────────────────────────────────────────────────────

/** Passed to `onPage` — the single URL being analyzed. */
export interface PageInput {
    /** Absolute URL of the page being analyzed. */
    url: string;
    /** Raw HTML content of the page. */
    html: string;
    /** HTTP status code. */
    status: number;
}

// ─── Scoped hook contexts ─────────────────────────────────────────────────────

/** Base context available in every hook. */
export interface PluginContext {
    /** Execution scope. Undefined only in legacy / test contexts — treated as permissive. */
    scope?: PluginScope;
    command?: string;
    /** Whether live fallback is allowed (from --live flag). Core-controlled. */
    live?: boolean;
    flags?: Record<string, any>;
    snapshotId?: number;
    targetUrl?: string;
    db?: CrawlithDB;
    config?: {
        get(key?: string): string;
        require(key?: string): string;
        set(value: string): void;
    };
    /** CLI writer — populated by the registry before each hook call. */
    cli?: CLIWriter;
    /** Legacy logger alias — kept for backwards compatibility. */
    logger?: CLIWriter;
    metadata?: Record<string, any>;
    [key: string]: any;
}

// ─── CLI option declaration ───────────────────────────────────────────────────

export interface PluginCliOption {
    /** e.g. '--my-flag <value>' */
    flag: string;
    description: string;
    defaultValue?: unknown;
}

// ─── Plugin storage declaration ───────────────────────────────────────────────

export type PluginColumnType = 'INTEGER' | 'REAL' | 'TEXT';

export interface PluginStorage {
    /** Whether this plugin fetches data from a network or computes locally. Defaults to 'network'. */
    fetchMode?: 'local' | 'network';
    /**
     * Per-URL columns to add to the plugin's scoped data table.
     * The core creates the table automatically before `onInit` runs,
     * so plugins never need to call `ctx.db.schema.define()`.
     */
    perPage?: {
        columns: Record<string, PluginColumnType>;
    };
}

// ─── Plugin interface ─────────────────────────────────────────────────────────

export interface CrawlithPlugin {
    name: string;
    version?: string;
    description?: string;

    /**
     * Declarative CLI registration.
     * The core registers these options on the appropriate commands —
     * no need to interact with Commander directly.
     *
     * `for` controls which commands expose the options:
     * - `['page', 'crawl']` (default when omitted) — both commands
     * - `['page']` — page command only
     * - `['crawl']` — crawl command only
     */
    cli?: {
        flag: string;
        description: string;
        for?: ('page' | 'crawl')[];
        options?: PluginCliOption[];
    };

    /**
     * Declarative storage schema.
     * The core creates the plugin's scoped table before `onInit` runs.
     * Plugins that don't persist data can omit this entirely.
     */
    storage?: PluginStorage;

    /**
     * Set to true to declare this plugin as a Score Provider.
     * The core will automatically aggregate the `score` and `weight` columns
     * from this plugin's storage table during snapshot aggregation.
     */
    scoreProvider?: boolean;

    /**
     * Legacy imperative CLI registration — kept for backwards compatibility.
     * Prefer `cli` for new plugins.
     * @deprecated Use `cli` instead.
     */
    register?: (cli: any) => void;

    hooks?: {
        /**
         * Runs on both `page` and `crawl` scopes.
         * Use for any setup that doesn't depend on the scope —
         * e.g. initialising in-memory state, reading config.
         * DB schema is already created by the time this runs (via `storage`).
         */
        onInit?: (ctx: PluginContext) => void | Promise<void>;

        /**
         * Single-page hook — `page` scope only.
         * Receives the target URL, its raw HTML, and HTTP status.
         * Use this for URL-scoped plugins (PageSpeed, heading-health, etc.).
         */
        onPage?: (ctx: PluginContext, page: PageInput) => void | Promise<void>;

        /**
         * Fired at the very start of a crawl — `crawl` scope only.
         * Use to initialise crawl-wide state or validate config.
         */
        onCrawlStart?: (ctx: PluginContext) => void | Promise<void>;

        /**
         * URL enqueue filter — `crawl` scope only.
         * Return `false` to prevent a URL from being crawled.
         */
        shouldEnqueueUrl?: (ctx: PluginContext, url: string, depth: number) => boolean;

        /**
         * Fired after each page is fetched and parsed — `crawl` scope only.
         * Use for real-time per-page processing without waiting for the full graph.
         */
        onPageParsed?: (ctx: PluginContext, page: any) => void | Promise<void>;

        /**
         * Fired after the full link graph is built — `crawl` scope only.
         * Graph structure is complete; metrics have not been computed yet.
         */
        onGraphBuilt?: (ctx: PluginContext, graph: any) => void | Promise<void>;

        /**
         * Graph-level metrics phase — `crawl` scope only.
         * All pages are available; use for cross-page analysis (duplicate
         * detection, PageRank, heading structure across the site, etc.).
         */
        onMetrics?: (ctx: PluginContext, graph: any) => void | Promise<void>;

        /**
         * Final report phase — `crawl` scope only.
         * Attach snapshot-level summary data to the result object.
         */
        onReport?: (ctx: PluginContext, report: any) => void | Promise<void>;
    };
}
