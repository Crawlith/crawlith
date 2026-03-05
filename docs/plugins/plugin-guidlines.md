# Crawlith Plugin Development Guide
This guide combines the Plugin Database & Configuration API with guidelines for creating high-quality, secure, and compliant Crawlith plugins. It provides a robust, type-safe, and secure API for plugins to persist data, manage configurations, and follow strict architectural patterns. This ensures data integrity, enforces security boundaries, and provides a fluent interface that reads like a sentence.

## 🏗️ Project Architecture & Standard Structure
All Crawlith plugins MUST follow this strict directory structure to maintain consistency and security. This separation of concerns keeps the package root clean, provides instant visibility into the plugin's identity and CLI footprint, and encapsulates heavy logic.

```text
my-plugin/
├── index.ts        # Declarative Manifest: Defines name and register (CLI footprint)
├── package.json    # Metadata and dependencies
├── tsconfig.json   # TypeScript configuration
└── src/
    ├── plugin.ts   # Hook Implementation: Lifecycle logic (onInit, onReport, etc.)
    ├── cli.ts      # CLI Hub: Command registrations and actions
    ├── types.ts    # Type definitions: Interfaces and shared types
    ├── Service.ts  # Logic Hub: Business logic and API clients
    └── Output.ts   # Presentation Hub: Formatting and logging
```

## Why This Structure?

1. Instant Visibility: Opening `index.ts` shows the plugin's identity and CLI footprint immediately.
2. Clean Separation: The "manifest" (index.ts) is separated from the "heavy logic" (src/plugin.ts).
3. Encapsulation: Keeps the package root clean while providing a clear entry point.

## Dependency Rules

- Always import types from `@crawlith/core`.
- Use ESM (.js extensions in imports for TypeScript projects).
- Avoid adding heavy external dependencies unless absolutely necessary.

## 📋 Context Reference (`PluginContext`)
Every hook receives a `ctx` object. Use these properties instead of global variables or direct imports.

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
## 🏗️ Database Strategy & Fluent API (`ctx.db`)
Plugins do not access the SQLite database directly. Instead, they use the `ctx.db` API, which is scoped to the plugin's name and the current snapshotId. This ensures data integrity and prevents raw SQL access.

### 1. Schema Definition
Every plugin that needs a dedicated table must register its schema during the `onInit` hook.

- Table Naming: Automatically creates a table named `<plugin_name>_plugin`.
- Default Columns: The system automatically adds `id`, `snapshot_id`, `url_id`, and `created_at`. Reserved Columns: DO NOT define these.
```typescript
ctx.db.schema.define({
    performance_score: "INTEGER",
    lcp: "REAL",
    raw_json: "TEXT NOT NULL"
});
```
### 2. URL-Scoped Data (data)
The data namespace is used for per-URL information. The system handles URL normalization and mapping—no manual ID resolution needed.

- data.save({ url, data }): Persists a row linked to the snapshot and specific URL.
- data.find<T>(url, options): Retrieves the latest row for a given URL with optional smart caching.
- - maxAge: String (e.g., "24h", "60m") or seconds (number). Filters entries newer than this.
- - global: Boolean. If true, looks across all snapshots instead of just the current one.
- data.all<T>(): T[]: Get all rows for your plugin in current snapshot.
- **Finding data with 24h global cache:TypeScript**
```typescript
const cached = ctx.db.data.find<PageSpeedRow>(pageUrl, { 
  maxAge: '24h', 
  global: true 
});
```
### 3. Snapshot Reports (report)
For global summaries for the entire `crawl/snapshot`. Optional for plugins that only provide page-level data.
- `ctx.db.report.save(summary: any)` - Persist an aggregate JSON object for the entire snapshot.
- `ctx.db.report.find<T>(): T | null` - Retrieve the current snapshot summary.
### 4. Declarative Storage (scoreProvider & fetchMode)
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
Note: score and weight are reserved columns managed automatically if omitted, but you can explicitly use them to define defaults.
### 5. Smart Caching (getOrFetch)
Replaces `db.data.find()` and `db.data.save()`. The core handles the `--live` flag logic natively:
**Example:**
```typescript
const row = await ctx.db.data.getOrFetch<MyRow>(
  page.url,
  async () => myService.compute(page.html) // Only executes if cache is stale or `--live` flag is passed
);
```
### 6. Secure Configuration API (`ctx.config`)
Plugins require credentials which are handled via the isolated `ctx.config` API.
**Usage**

- `ctx.config.get()`: Retrieves the decrypted key for the current plugin.
- `ctx.config.set(value)`: Encrypts and saves a key for the current plugin.
- `ctx.config.require()`: Retrieves the key (throws if missing).
- **Rule:** Only call without arguments—do not spy on other sections.

### Standard CLI Registration
To allow users to configure your plugin via `crawlith config <plugin> set <key>`, use the core helper in your register method:
```typescript
import { registerPluginConfigCommand } from '@crawlith/core';

export const MyPlugin: CrawlithPlugin = {
  name: 'my-plugin',
  register: (cli) => {
    registerPluginConfigCommand(cli, 'my-plugin', 'API Key');
  }
};
```
### 🪝 Plugin Hooks Lifecycle
|Hook|Purpose   
|---|---
onInit|Database schema registration and initialization. No side effects beyond schema/config.
onCrawlStart|Called when a full crawl begins.
onPageParsed|Real-time processing of page content during crawl. Use ctx.targetUrl.
onReport|Post-crawl analysis, report generation, and persistence.

### 📝 Documentation & JSDoc Standards

All plugins MUST be self-documenting. Use JSDoc blocks for every exported class, method, and hook.

1. Plugin Header: Describe the plugin's purpose, key features, and requirements (e.g., `@requirements List any API keys or CLI flags needed.`).
2. Hook Blocks: Briefly explain what the hook does.
3. Service Methods: Document parameters, return types, and potential errors.
4. Tools: Use `typedoc` for generation; commit updates to `docs/api/`.
**Example:**

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

### 🚫 Forbidden Patterns (Non-Negotiable)

1. No Raw DB Access: Never use better-sqlite3 directly. No db.prepare() or db.exec().
2. No Unsafe Methods: Calling ctx.db.unsafeGetRawDb() is a non-negotiable Security Violation. Any plugin doing this will be rejected or banned.
3. No Manual ID Resolution: Do not attempt to query snapshots or pages tables for IDs. Use the URL-based data methods.
4. No Section Spying: Only call ctx.config.get() or ctx.config.require() without arguments.
5. No Side Effects in onInit: onInit should only define schema and basic configuration.
6. No Logging without Context: Always use ctx.logger.
7. No Duplication: Search codebase for patterns before adding code.

### 📝 Generation Workflow for AI Agent

1. Project Setup: Create the multi-file structure in `src/`.
2. Implementation: Define hook logic in `src/plugin.ts`. Use `ctx.targetUrl` and `ctx.config.require()`.
3. Manifest: Create `index.ts` to define name and register, importing hooks from `src/plugin.ts`.
4. CLI Registration: Use `registerPluginConfigCommand(cli, name, label)` in `src/cli.ts`.
5. External Services: Put API clients (e.g., PageSpeed, OpenAI) in `src/Service.ts`.
6. Self-Documenting Code: Add JSDoc blocks to every class, method, and hook.
7. Data Persistence: Implement 24h caching in `src/plugin.ts` using `ctx.db.data.find(url, { maxAge: '24h', global: true })`.