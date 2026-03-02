# Crawlith - AI Agent Instructions 🧠

Hello, Agent! You are operating on **Crawlith**, a professional-grade SEO Intelligence Engine. This is a high-performance **pnpm monorepo** designed for deterministic link-graph analysis and site auditing.

When operating in this codebase, you **MUST** adhere to the following rules, architecture constraints, and workflows.

---

##  1. Monorepo Structure

| Package        | Path               | Purpose                                                       |
| :------------- | :----------------- | :------------------------------------------------------------ |
| **`core`**     | `packages/core`    | The heavy-lifting engine (Graph math, BFS Crawler, SQLite).   |
| **`cli`**      | `packages/cli`     | The terminal interface (Chalk-themed, premium DX).            |
| **`web`**      | `packages/web`     | React dashboard (Vite + Tailwind).                            |
| **`server`**   | `packages/server`  | REST API layer bridge.                                        |
| **`plugins`** | `packages/plugins` | Modular intelligence (PageRank, Soft404, etc). |

---

## 🎯 2. Core Architecture & Philosophy

- **Crawler [BFS]**: Always use Breadth-First Search for deterministic path discovery.
- **Graph Engine**: Rely on the `Graph` class in `core`. Links must be treated as weighted directed edges.
- **Data Persistence**: All snapshot data must be persisted via the `db` layer using `better-sqlite3`.
- **Premium DX**: Every terminal output must be beautiful. Use `chalk`, `p-limit` for concurrency, and `ora` for spinners.
- **Plugin Registry**: Add functionality via the **Plugin System**. Standardize results using the `onMetrics` and `onReport` hooks.

---

## 🛡️ 3. Safety & Security (IPGuard)

Crawlith is built with **SSRF Protection**. Never bypass these security boundaries:
- **`IPGuard`**: Pre-fetch DNS resolution blocks private/cloud-metadata IPs.
- **`RedirectController`**: Hop limits (Default: 2, Max: 11) with loop detection.
- **Rate Limiting**: Enforce 2 req/sec Token Bucket limits unless explicitly overridden.
- **Scope**: Respect `DomainFilter` and `SubdomainPolicy` at all times.

---

## 🛠️ 4. Standard Workflows

### Build & Rebuild
```bash
# Clean everything and rebuild from scratch
pnpm run rebuild
```

### Testing & Coverage
We use `vitest` for the entire suite. A root `vitest.config.ts` manages workspace tests.
```bash
# Run tests with the workspace config
pnpm run test --coverage
```

### Formatting & Linting
```bash
# Respect the strict ESLint config
pnpm run lint
```

### Documentation Standards
- **Doc Blocks Required**: You MUST write comprehensive JSDoc/TSDoc blocks for every `namespace`, `function`, `interface`, and `class` you create or significantly modify.
- **Content**: Include descriptions, `@param` for arguments, `@returns` for return types, and clear explanations of the code's purpose.

---

## 📁 5. Navigation Hotspots

- **Engine Logic**: `packages/core/src/crawler/`
- **Graph Math**: `packages/core/src/graph/`
- **CLI Commands**: `packages/cli/src/commands/`
- **Plugin Hooks**: `packages/core/src/plugin-system/`
- **Root Config**: `package.json` (workspace controls)

---

## 🚀 6. Current Priority Goals

Refer to this list if the USER asks for direction:
1. **JS Rendering (Beta)**: Integration for Playwright/Puppeteer SEO audits.
2. **Multi-Host Crawling**: Safe cross-domain cluster analysis.
3. **Database Migrations**: Refine the SQLite schema for 1M+ page crawls.
4. **Enhanced UI**: Add real-time filtering to the dashboard graph view.

---
<div align="center">
  <sub>Deterministic Crawl Intelligence. Shift-Left SEO.</sub>
</div>
