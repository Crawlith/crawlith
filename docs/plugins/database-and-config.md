# Plugin Database & Configuration API

Crawlith provides a robust, type-safe, and secure API for plugins to persist data and manage configurations. This infrastructure ensures data integrity, enforces security boundaries, and provides a fluent interface that reads like a sentence.

---

## 🏗️ Database Strategy

Plugins do not access the SQLite database directly. Instead, they use the `ctx.db` API, which is **scoped** to the plugin's name and the current `snapshotId`.

### 1. Schema Definition
Every plugin that needs a dedicated table must register its schema during the `onInit` hook.

*   **Table Naming**: Automatically creates a table named `<plugin_name>_plugin`.
*   **Default Columns**: The system automatically adds `id`, `snapshot_id`, `url_id`, and `created_at`.

```typescript
ctx.db.schema.define({
    performance_score: "INTEGER",
    lcp: "REAL",
    raw_json: "TEXT NOT NULL"
});
```

### 2. URL-Scoped Data (`data`)
The `data` namespace is used for per-URL information. You don't need to resolve IDs manually; the system handles URL normalization and mapping.

*   **`data.save({ url, data })`**: Persists a row linked to the snapshot and specific URL.
*   **`data.find<T>(url, options)`**: Retrieves the latest row for a given URL with optional smart caching.

```typescript
// Finding data with 24h global cache
const cached = ctx.db.data.find<PageSpeedRow>(pageUrl, { 
  maxAge: '24h', 
  global: true 
});
```

### 3. Snapshot Reports (`report`)
For global summaries for the entire crawl/snapshot. **Optional** for plugins that only provide page-level data.

*   `ctx.db.report.save(summary: any)` - Persist an aggregate JSON object for the entire snapshot.
*   `ctx.db.report.find<T>(): T | null` - Retrieve the current snapshot summary.

---

## 🔐 Secure Configuration API

Plugins require credentials which are handled via the isolated `ctx.config` API.

### Usage
*   **`ctx.config.get()`**: Retrieves the decrypted key for the current plugin.
*   **`ctx.config.set(value)`**: Encrypts and saves a key for the current plugin.

### Standard CLI Registration
To allow users to configure your plugin via `crawlith config <plugin> set <key>`, use the core helper in your `register` method:

```typescript
import { registerPluginConfigCommand } from '@crawlith/core';

export const MyPlugin: CrawlithPlugin = {
  name: 'my-plugin',
  register: (cli) => {
    registerPluginConfigCommand(cli, 'my-plugin', 'API Key');
  }
};
```

---

## 🏗️ Standard Project Structure

To maintain consistency and security, all Crawlith plugins MUST follow this strict directory structure:

*   **`index.ts`**: **The Declarative Manifest**. Defines the `name` and `register` method. It acts as the visual contract showing what the plugin adds to the CLI.
*   **`src/plugin.ts`**: **Hook Implementation**. Contains the actual `hooks` logic.
*   **`src/cli.ts`**: **CLI Hub**. Handles internal logic for complex `Command` registrations.
*   **`src/types.ts`**: **Type definitions**. All interfaces and shared types go here.
*   **`src/Service.ts`**: **Logic Hub**. Actual business logic and API clients.
*   **`src/Output.ts`**: **Presentation Hub**. Formatting and logging.

```text
my-plugin/
├── index.ts        # Declarative Manifest (name + register)
├── package.json
└── src/
    ├── plugin.ts   # Hook implementation (onInit, onReport, etc.)
    ├── cli.ts      # Command implementations
    ├── types.ts    # Shared interfaces
    └── ...         # Services, Output, etc.
```

### Why this structure?
1.  **Instant Visibility**: Opening `index.ts` shows the plugin's identity and CLI footprint immediately.
2.  **Clean Separation**: The "manifest" (index.ts) is separated from the "heavy logic" (src/hooks.ts).
3.  **Encapsulation**: Keeps the package root clean while providing a clear entry point.