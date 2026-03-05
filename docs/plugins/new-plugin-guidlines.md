# AI Agent Guide: Creating Crawlith Plugins

This guide provides the strict rules, architectural patterns, and API context required for an AI agent to generate high-quality, secure, and compliant Crawlith plugins.

---

## 📋 Context Reference (`PluginContext`)

Every hook receives a `ctx` object. As an AI Agent, you MUST use these properties instead of global variables or direct imports.

```typescript
export interface PluginContext {
    command?: string;        // The current CLI command being executed (e.g., 'page', 'crawl')
    flags?: Record<string, any>; // CLI flags passed by the user
    snapshotId?: number;     // The ID of the current snapshot (automatically bound in ctx.db)
    targetUrl?: string;      // The normalized absolute URL of the page being analyzed
    db: CrawlithDB;          // Scoped DB API (Fluent)
    config: PluginConfig;    // Scoped Config API
    logger: {
        info(msg: string): void;
        warn(msg: string): void;
        error(msg: string): void;
        debug(msg: string): void;
    };
}
```

---

## 🏗️ Project Architecture

All plugins MUST follow the separation of concerns between lifecycle management and business logic.

### File Structure
```text
packages/plugins/<name>/
├── index.ts        # Manifest: Defines name and register (CLI footprint)
├── package.json    # Metadata and dependencies
├── tsconfig.json   # TypeScript configuration
└── src/            # Implementation
    ├── plugin.ts   # Lifecycle: Implementation of export { MyHooks }
    ├── cli.ts      # Commands: Registration and Actions logic
    ├── types.ts    # Types: Interfaces and constant definitions
    ├── Service.ts  # Logic: Core business logic & external APIs
    └── Output.ts   # Presentation: Formatting & CLI Logging
```

### Dependency Rules
*   Always import types from `@crawlith/core`.
*   Use ESM (`.js` extensions in imports for TypeScript projects).
*   Avoid adding heavy external dependencies unless absolutely necessary.

---

## 🌊 Fluent Database API (`ctx.db`)

Plugins are strictly forbidden from accessing raw SQL. Use the scoped fluent API. The system automatically scopes all calls to your plugin's name and the current `snapshotId`.

### 1. Schema Definition (`onInit`)
Define columns for your plugin table. 
*   **Table Name**: Automatically inferred as `<plugin_name>_plugin`.
*   **Reserved Columns**: DO NOT define `id`, `snapshot_id`, `url_id`, or `created_at`. These are added automatically.

```typescript
ctx.db.schema.define({
    performance_score: "INTEGER",
    lcp: "REAL",
    raw_json: "TEXT NOT NULL"
});
```

### 2. URL-Scoped Data (`data`)
For data tied to specific pages/URLs.

*   `ctx.db.data.save({ url: string, data: T })` - Save page-level results.
*   `ctx.db.data.find<T>(url, options)` - Get row with smart caching:
    *   `maxAge`: String (e.g., "24h", "60m") or seconds (number). Filters entries newer than this.
    *   `global`: Boolean. If `true`, looks across **all snapshots** instead of just the current one.
*   `ctx.db.data.all<T>(): T[]` - Get all rows for your plugin in current snapshot.

*   `ctx.db.data.all<T>(): T[]` - Get all rows for your plugin in current snapshot.

### 3. Declarative Storage (`scoreProvider` & `fetchMode`)
Plugins should use declarative storage to define their caching and scoring strategies natively:

```typescript
export const MyPlugin: CrawlithPlugin = {
  name: 'my-plugin',
  scoreProvider: true, // Enables automatic weighting & aggregation in the core
  storage: {
    fetchMode: 'local', // 'network' | 'local'
    perPage: {
      columns: {
        score: 'REAL',
        weight: 'REAL',
        reason: 'TEXT'
      }
    }
  }
};
```
Note: `score` and `weight` are reserved columns managed automatically if omitted, but you can explicitly use them to define defaults.

### 4. Smart Caching (`getOrFetch`)
Replaces `db.data.find()` and `db.data.save()`. The core handles the `--live` flag logic natively:

**Example:**
```typescript
const row = await ctx.db.data.getOrFetch<MyRow>(
  page.url,
  async () => myService.compute(page.html) // Only executes if cache is stale or --live flag is passed
);
```


---

## 🪝 Plugin Hooks Lifecycle

| Hook | Purpose |
| :--- | :--- |
| `onInit` | Database schema registration and initialization. |
| `onCrawlStart` | Called when a full crawl begins. |
| `onPageParsed` | Real-time processing of page content during crawl. |
| `onReport` | Post-crawl analysis, report generation, and persistence. |

---

## 📝 Documentation & JSDoc

All plugins MUST be self-documenting. Use JSDoc blocks for every exported class, method, and hook.

1.  **Plugin Header**: Describe the plugin's purpose, key features, and requirements.
2.  **Hook Blocks**: Briefly explain what the hook does.
3.  **Service Methods**: Document parameters, return types, and potential errors.

---

## 🚫 Forbidden Patterns (Non-Negotiable)

1.  **No Raw DB Access**: Never use `better-sqlite3` directly. No `db.prepare()` or `db.exec()`.
2.  **No Unsafe Methods**: Calling `ctx.db.unsafeGetRawDb()` is a non-negotiable Security Violation. Any plugin doing this will be rejected or banned.
3.  **No Manual ID Resolution**: Do not attempt to query `snapshots` or `pages` tables for IDs. Use the URL-based `data` methods.
4.  **No Section Spying**: Only call `ctx.config.get()` or `ctx.config.require()` without arguments.
5.  **No Side Effects in onInit**: `onInit` should only define schema and basic configuration.
6.  **No Logging without Context**: Always use `ctx.logger`.

---

## 📝 Generation Workflow for AI Agent
1.  **Project Setup**: Create the multi-file structure in `src/`.
2.  **Implementation**: Define hook logic in `src/plugin.ts`. Use `ctx.targetUrl` and `ctx.config.require()`.
3.  **Manifest**: Create `index.ts` to define `name` and `register`, importing `hooks` from `src/plugin.js`.
4.  **CLI Registration**: Use `registerPluginConfigCommand(cli, name, label)` in `src/cli.ts`.
5.  **External Services**: Put API clients (e.g. PageSpeed, OpenAI) in `src/Service.ts`.
6.  **Self-Documenting Code**: Add JSDoc blocks to every class, method, and hook.
7.  **Data Persistence**: Implement 24h caching in `src/plugin.ts` using `ctx.db.data.find(url, { maxAge: '24h', global: true })`.

---

## 📖 Documentation Example

```typescript
/**
 * Plugin Description: What it does and why.
 * @requirements List any API keys or CLI flags needed.
 */
export const MyPlugin: CrawlithPlugin = {
  name: 'my-plugin',
  
  /**
   * Describes the hook's specific role in this plugin.
   */
  hooks: {
    onInit: async (ctx) => {
      // ...
    }
  }
};
```
