# Crawlith Architecture

> Modular crawl intelligence engine for deterministic SEO analysis.

## Overview

Crawlith is a monorepo-based CLI tool and web dashboard that crawls websites, builds internal link graphs, computes SEO metrics, and surfaces actionable insights. The architecture follows a layered design where the core engine (`@crawlith/core`) contains all major crawling, graphing, and analysis capabilities, while optional capabilities and third-party extensions can be added via a plugin system.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Interfaces                                │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐  ┌────────────┐  │
│  │   CLI    │  │  Server  │  │    Web Dashboard       │  │ MCP Server │  │
│  │ (cmdr)   │  │(express) │  │    (React + Vite)      │  │ (SDK)      │  │
│  └────┬─────┘  └────┬─────┘  └────────────────────────┘  └─────┬──────┘  │
│       │              │                                         │         │
│       ▼              ▼                                         ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                          @crawlith/core                              │ │
│  │      Crawler · Graph · DB · Core Analysis Algorithms                 │ │
│  │      (PageRank, Duplicates, Clustering, Health, etc.)                │ │
│  └────────┬────────────────────────────────────────────────────────────┘ │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────────────────┐                 │
│  │             Extension Plugins (Optional)             │                 │
│  │     (PageSpeed, Custom Exporters, Signals, etc.)     │                 │
│  └─────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Package Map

| Package | Name | Purpose |
|---------|------|---------|
| `packages/core` | `@crawlith/core` | Engine: crawler, graph, DB, core analysis, metrics, plugin contracts |
| `packages/cli` | `@crawlith/cli` | Commander-based CLI: the primary execution entry point |
| `packages/server` | `@crawlith/server` | Express REST API for the dashboard |
| `packages/web` | `@crawlith/web` | React + Tailwind dashboard UI |
| `packages/mcp` | `@crawlith/mcp` | Model Context Protocol integration for AI agents (Claude) |
| `packages/plugins/*` | `@crawlith/plugin-*` | Optional extension plugins |
| `.opencode/plugins`| `CrawlithPlugin` | OpenCode-specific integration plugin |

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
- **MCP Server** wraps the CLI commands into standardized tools and prompts, enabling AI agents to autonomously audit sites.

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
| **Fetcher / Network**| `crawler/fetcher.ts` | HTTP client with retry, rate limiting, and SSRF protection (IPGuard) |
| **Parser** | `crawler/parser.ts` | HTML parsing via Cheerio, link/meta/structured data extraction |
| **Trap Detection** | `crawler/trap.ts` | Infinite crawl loop prevention (recursive path detection) |
| **Metrics Runner** | `crawler/metricsRunner.ts` | Coordinates graph/analysis modules post-crawl |

### Graph & Centrality

| Module | File | Responsibility |
|--------|------|----------------|
| **Graph Context** | `graph/graph.ts` | In-memory representations of nodes, edges, and clusters |
| **PageRank**| `graph/pagerank.ts` | High-performance node importance scoring using TypedArrays |
| **HITS** | `graph/hits.ts` | Hub and Authority scores computation for authority discovery |
| **SimHash** | `graph/simhash.ts` | 64-bit locality-sensitive hashing for near-duplicate clustering |

### Core Analysis

Major SEO capabilities are directly built into the core for maximum performance:

| Module | Purpose |
|--------|---------|
| **Analyze / Health** | Overall snapshot health scoring (0-100) based on weighted heuristics |
| **Duplicates** | Near-duplicate detection using SimHash and exact content hashes |
| **Clustering** | Path-based and structural grouping of URLs |
| **Orphans** | Detecting orphaned pages and applying severity scores based on inbound link count |
| **Diffing** | Comparing snapshot graphs to identify structural regressions over time |

### Database (`CrawlithDB` via better-sqlite3)

Crawlith persists crawl data immediately, using an efficient WAL-mode SQLite database located at `~/.crawlith/crawlith.db`. 

| Table / Purpose | Description |
|-----------------|-------------|
| **Data Scope**  | Standard tables for `sites`, `snapshots`, `pages`, `edges`, and `metrics`. |
| **CrawlithDB Wrapper** | Encapsulates the raw `better-sqlite3` instance with schema/data namespaces. |
| **Safety** | Enforces row-level isolation and permissioning (0o600) for database files. |

---

## Plugin System

Crawlith supports a robust hook-based plugin system to extend the engine without modifying the core.

### Contract

Every plugin implements the `CrawlithPlugin` interface, allowing it to:
- Define custom CLI flags and database schemas.
- Intercept execution hooks (`onInit`, `onMetrics`, `onReport`, `onGraphSave`).
- Register Model Context Protocol (MCP) tools and prompts via `onMcpDiscovery`.

---

## User Interfaces

### 1. Command Line Interface (CLI)
Built on `commander`, it supports JSON formatting for integration and standard "pretty" printing for humans.
- `crawl <url>`: Sitegraph crawl.
- `page <url>`: Real-time dynamic analysis.
- `sites`: Snapshot management.

### 2. Web Dashboard
A high-performance React dashboard powered by a bundled Express server. It uses D3-style radial layouts for graph exploration and interactive trend charts for history.

### 3. MCP Server
Exposes Crawlith's engine as a set of tools (e.g., `crawl_site`, `analyze_page`) for LLM agents, enabling automated SEO auditing workflows.

---

## Future State (Roadmap Alignment)

The architecture is currently evolving towards:
1. **Hybrid Rendering**: Integrating Playwright for JS-heavy applications.
2. **Resilient Crawling**: Persistent crawl states allowing pause/resume operations.
3. **Predictive Simulation**: Structural simulation to forecast PageRank changes before site updates.
4. **Distributed Engine**: Parallel partitioning for multi-million node crawls.
