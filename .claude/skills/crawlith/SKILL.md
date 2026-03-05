# Crawlith Skill for Claude

A specialized skill for performing deterministic SEO audits, link graph analysis, and site health monitoring using the Crawlith engine.

## Purpose
Use this skill when a user wants to:
- Audit a website for technical SEO issues (broken links, redirect loops, crawl traps).
- Visualize or analyze internal link topology and authority flow.
- Monitor site health over time through snapshots and diffing.
- Identify orphaned pages or content clusters.

## Available Tools (via MCP)

### `ensure_crawlith_cli`
- **Description**: Verifies if the Crawlith CLI is installed and optionally installs it.
- **When to use**: First step in any new environment to ensure the engine is ready.

### `crawl_site`
- **Description**: Performs a full BFS crawl of a site to build a link graph.
- **Key Flags**: `limit`, `depth`, `concurrency`, `sitemap`, `noQuery`.
- **When to use**: To get a complete overview of a site's structure.

### `analyze_page`
- **Description**: Analyzes a single URL for SEO, content, and accessibility signals.
- **When to use**: Quick diagnostics for a specific landing page.

### `probe_domain`
- **Description**: Inspects TLS, transport layer, and HTTP headers.
- **When to use**: Diagnosing connectivity, SSL expiry, or security header issues.

### `list_sites`
- **Description**: Lists all sites and snapshots currently in the local database.
- **When to use**: Checking history or finding a previous snapshot ID.

### `full_site_audit`
- **Description**: Preset tool that runs a comprehensive crawl (2000 pages, depth 10).

### `portfolio_status`
- **Description**: Summarizes health across all tracked domains.

## Prompts

### `full_site_audit`
- **Intent**: Guide Claude through a multi-step audit (Crawl -> Page Analysis -> Domain Probe).

### `portfolio_status`
- **Intent**: Assess the state of all crawled sites and recommend next actions.

## Core Concepts for Analysis

- **PageRank**: Internal authority flow. High PageRank nodes are structurally important.
- **HITS (Hubs/Authorities)**: Identifies key navigation pages (Hubs) vs. destination pages (Authorities).
- **Content Clustering**: Groups pages with similar layouts/boilerplates.
- **Orphans**: Sitemap URLs with zero internal links.
- **Health Score**: A weighted 0-100 metric where <50 is critical.

## Best Practices
1. **Always use `--format json`** (handled automatically by MCP tools) for data ingestion.
2. **Start Small**: Use `--limit 100` for a quick scan before committing to a full audit.
3. **Respect robots.txt**: Default behavior is to follow rules; do not override unless requested.
4. **Link Analysis**: Use `list_sites` to compare the latest snapshot with previous ones to find regressions.
5. **Security First**: Do not share or log raw database contents if they contain sensitive metadata.

## Common Workflows

### 1. The "First Look" Audit
1. `ensure_crawlith_cli`
2. `crawl_site` with `limit: 200`, `depth: 3`
3. `analyze_page` on the homepage.
4. Summarize findings and Health Score.

### 2. Finding Authority Leaks
1. `crawl_site` with `computePagerank: true`
2. Identify pages with high PageRank that link to few internal pages.
3. Recommend linking to high-value conversion pages.

### 3. Cleaning Up Legacy Data
1. `list_sites` to see all snapshots.
2. Use the CLI `clean` command (via shell if tool is missing) to remove old data.
