# Crawlith Architecture

> Modular crawl intelligence engine for deterministic SEO analysis.

## Overview

Crawlith is a monorepo-based CLI tool and web dashboard that crawls websites, builds internal link graphs, computes SEO metrics, and surfaces actionable insights. The architecture follows a layered design where the core engine (`@crawlith/core`) contains all major crawling, graphing, and analysis capabilities, while optional capabilities and third-party extensions can be added via a plugin system.

```
┌─────────────────────────────────────────────────────────┐
│                      User Interfaces                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │   CLI    │  │  Server  │  │    Web Dashboard       │ │
│  │ (cmdr)   │  │(express) │  │    (React + Vite)      │ │
│  └────┬─────┘  └────┬─────┘  └────────────────────────┘ │
│       │              │                                    │
│       ▼              ▼                                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                  @crawlith/core                      │ │
│  │  Crawler · Graph · DB · Core Analysis Algorithms     │ │
│  │  (PageRank, Duplicates, Clustering, Health, etc.)    │ │
│  └────────┬────────────────────────────────────────────┘ │
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │             Extension Plugins (Optional)             │ │
│  │     (PageSpeed, Custom Exporters, Signals, etc.)     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Package Map

| Package | Name | Purpose |
|---------|------|---------|
| `packages/core` | `@crawlith/core` | Engine: crawler, graph, DB, core analysis, metrics, plugin contracts |
| `packages/cli` | `@crawlith/cli` | Commander-based CLI |
| `packages/server` | `@crawlith/server` | Express REST API for the dashboard |
| `packages/web` | `@crawlith/web` | React + Tailwind dashboard UI |
| `packages/shared` | `@crawlith/architecture-shared` | Cross-cutting types (`CommandName`) |
| `packages/infrastructure` | `@crawlith/architecture-infrastructure` | Adapter layer (fetcher, logger, filesystem) |
| `packages/plugins/*` | `@crawlith/plugin-*` | Optional extension plugins |
| `packages/mcp` | `@crawlith/mcp` | Model Context Protocol integration |

### Dependency Flow

```
Optional Plugins ──► core ◄── server ◄── cli ◄── web (bundled into cli)
                            (CLI is the consumer that wires plugins in)
```

- **Core** defines the interfaces, the database manager, and the crawler itself. Core includes essential domain modules natively (Duplicates, PageRank). It has zero knowledge of specific plugins.
- **Plugins** depend only on `core` (for types, database scope access, and utility functions).
- **CLI** acts as the composition root. It parses user arguments, dynamically loads the requested plugins, and passes them to the core execution engine.
- **Server** depends on `core` to read database snapshots and run targeted on-page analysis. It's bundled into the CLI application.
- **Web** is a standalone Vite/React app, built and copied into the CLI's `dist/ui` folder at build time.

---

## Core Engine (`@crawlith/core`)

The core is organized into highly structured functional layers, encapsulating everything from raw HTTP fetching to topological graph metrics.

### Crawler Pipeline

```
URL → Fetcher → Parser → Normalizer → Graph Builder → Snapshot (DB)
```

| Module | File | Responsibility |
|--------|------|----------------|
| **Crawl Orchestrator** | `crawler/crawl.ts` | BFS traversal, depth/page limits, configuration |
| **Fetcher / Network**| `crawler/fetcher.ts` | HTTP client with retry, rate limiting, redirects |
| **Parser** | `crawler/parser.ts` | HTML parsing via Cheerio, link/meta extraction |
| **Normalizer** | `crawler/normalize.ts` | URL canonicalization, trailing slashes, param removal |
| **Trap Detection** | `crawler/trap.ts` | Infinite crawl loop prevention (filters infinite patterns) |
| **Metrics Runner** | `crawler/metricsRunner.ts` | Coordinates the execution of graph/analysis modules post-crawl |

### Graph & Centrality

| Module | File | Responsibility |
|--------|------|----------------|
| **Graph Context** | `graph/graph.ts` | In-memory representations of nodes, edges, content clusters |
| **PageRank**| `graph/pagerank.ts` | Node importance scoring based on inbound link topology |
| **HITS** | `graph/hits.ts` | Hub and Authority scores computation |
| **SimHash** | `graph/simhash.ts` | 64-bit locality-sensitive hashing for content fingerprinting |

### Core Analysis

Major SEO capabilities are directly built into the core for maximum performance and stability:

| Module | Purpose |
|--------|---------|
| **Analyze / Health** | Single URL analysis, overall snapshot health scoring |
| **SEO / Content** | Title length, meta description, word count, text-to-HTML ratio |
| **Duplicates** | Exact & near-duplicate clustering, canonical conflict detection |
| **Clustering** | Grouping structurally similar URLs and path patterns |
| **Orphans** | Detecting orphaned pages and applying severity scores (`OrphanIntelligence`) |
| **Diffing** | Comparing snapshot graphs to summarize site changes |

### Database (`CrawlithDB` via better-sqlite3)

Crawlith persists crawl data immediately, using an efficient WAL-mode SQLite database. 

| Table / Purpose | Description |
|-----------------|-------------|
| **Data Scope**  | The DB maintains standard tables (`sites`, `snapshots`, `pages`, `edges`, `metrics`). |
| **CrawlithDB Wrapper** | Encapsulates the raw `better-sqlite3` instance. Provides a fluent namespace API (`db.schema.define()`, `db.data.save()`) for analysis modules and plugins to register tables cleanly. |
| **Safety** | Enforces row-level isolation so modules cannot interact with each other's custom tables without explicit coordination. Automatically scopes queries by URL ID and Snapshot ID. |

### Security & Limits

| Module | Responsibility |
|--------|----------------|
| **Rate Limiter** | Request throttling (`crawler/rateLimiter.ts`). |
| **Lock Manager** | File-system based locking (`lock/lockManager.ts`) to prevent concurrent crawls corrupting the same domain footprint. |
| **Memory Shield**| Safe tracking of object limits to prevent Out-of-Memory crashes during graph building. |

---

## Plugin System

While core algorithms are native to the engine, Crawlith supports a plugin ecosystem for extensions (e.g., PageSpeed Insights, Exporters).

### Contract

Every plugin implements the `CrawlPlugin` interface defined in `@crawlith/core/plugin-system/plugin-types.ts`:

```typescript
export interface CrawlPlugin {
    name: string;
    cli?: {
        flag?: string;
        description?: string;
        optionalFor?: CommandName[];
        defaultFor?: CommandName[];
    };
    extendSchema?(schema: SchemaBuilder): void;
    hooks?: {
        onInit?(ctx: EngineContext): Promise<void>;
        onMetrics?(ctx: EngineContext, graph: Graph): Promise<void>;
        onReport?(ctx: EngineContext, report: any): Promise<void>;
        onGraphSave?(ctx: EngineContext, db: CrawlithDB): Promise<void>;
    };
}
```

- **Hooks**: Allows plugins to intercept execution right before crawling, during topological analysis (`onMetrics`), or during final report generation (`onReport`).
- **Storage API**: Using `ctx.scopedDb(pluginName)`, plugins can generate their own SQLite tables dynamically and store state.
- **Dynamic Activation**: The CLI loads plugins if they are marked `defaultFor` a specific command, or if an `optionalFor` flag was triggered.

---

## Command Line Interface (CLI)

The CLI packages (`@crawlith/cli`) expose commands to interact with the engine. The CLI logic directly leverages the capabilities exported by `core`.

| Command | Description | Example Arguments |
|---------|-------------|-------------------|
| `crawl <url>` | Full site crawl, BFS graph build | `--depth 5 --limit 100 --orphans --compute-pagerank` |
| `page <url>` | Single page dynamic SEO probe | `--format json` |
| `diff <url> <url>` | Compare multiple local snapshots | `--compare` |
| `ui <domain>` | Boot up the Web Dashboard locally | - |
| `sites` / `clean` | State / database administration | `clean https://example.com` |

---

## API & Web Dashboard

The Express server (`@crawlith/server`) serves up the Web Application and interfaces directly via REST API calls.

| Concept | Description |
|---------|-------------|
| **Snapshot Retrieval** | Dashboard visualizes data historically. Endpoints resolve `?snapshot=<id>` to pick specific rows from the DB. |
| **Analysis Probes** | Using the unified `analyzeSite()` function from core, the server can provide real-time on-page diagnostics requested by the frontend (`/api/page`). |
| **Separation** | The server is stateless beyond its connection to the SQLite instance located at `~/.crawlith/crawlith.db`. |

---

## Testing & Quality

- **Framework**: Vitest v4
- **Coverage**: ~260 tests across >50 test suites.
- **Testing Approach**: 
  - Sub-modules undergo isolated unit tests (e.g., scoring logic, duplicate detection boundaries, fetcher retries).
  - Integration tests build complete topological graphs across full database roundtrips.
- **Mocking**: In-memory database context (`:memory:`) via test teardowns ensures clean isolation between test processes.

Run the suite:
```bash
pnpm test
```

---

## Key Design Principles

1. **Centralized Domain Intelligence**: First-party analysis rules (like detecting duplicate content, structural orphans, or scoring Health) live solidly inside `@crawlith/core`.
2. **Immutable Snapshots**: Every crawl results in a new snapshot ID instead of mutations. We append over time, enabling topological difference detection ("Diffing").
3. **Single Dependency Footprint**: A standard build bundles everything down to a simple Node script entry-point managed by tsup, eliminating heavy local dependencies for consumers.
4. **Relational Scale over pure Memory**: To push past Node.js memory limits for massive sites, the crawler streams rows into SQLite safely. Graph aggregation logic runs lazily on the backend without retaining massive strings in memory.
