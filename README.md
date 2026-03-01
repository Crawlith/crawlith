# Crawlith

Crawlith is a high-performance Node.js + TypeScript CLI tool and Web Dashboard for crawling websites, auditing infrastructure, and generating internal link graphs.

## Features

- Crawls websites using BFS algorithm
- Respects `robots.txt` and rate limits
- Generates interactive D3.js visualization and HTML reports
- Unified export system (JSON, CSV, Markdown)
- Detects critical issues (orphans, broken links, redirect chains, crawl traps, soft 404s)
- Production-grade SQLite persistent storage for crawls (`~/.crawlith/crawlith.db`)
- Snapshot-based metrics and history tracking
- **NEW**: Interactive Web Dashboard for visualizing snapshots (`crawlith ui`)
- **NEW**: Deep infrastructure auditing (TLS, DNS, Security) (`crawlith audit`)
- **NEW**: Monorepo Architecture with core library and decoupled clients

## Installation

As this is an npm workspaces monorepo:

```bash
npm install
npm run build
```

To use the CLI globally or link it:
```bash
npm link ./packages/cli
```

*(Note: In development, you can use `npm run crawlith -- <command>` to run the CLI directly from the root).*

## Usage

### Crawl Crawl
Crawl a site and run analysis:
```bash
crawlith crawl https://example.com [options]
```

### Web UI Dashboard
Launch the interactive web dashboard to review your recent crawls:
```bash
crawlith ui
```

### Infrastructure Audit
Run transport, TLS, and DNS checks against a target:
```bash
crawlith audit https://example.com
```

### Export Data
To export the latest completed crawl data for a domain using the unified exporter:
```bash
crawlith export https://example.com --export json,html,visualize,csv
```

### Key Options

- `--limit <number>`: Max pages (default: 500)
- `--depth <number>`: Max click depth (default: 5)
- `--output <path>`: Output directory
- `--incremental`: Re-crawl efficiently using ETag/Last-Modified caching from the last snapshot
- `--detect-soft404`: Detect soft 404 pages using heuristics
- `--detect-traps`: Identify limitless dynamic parameter spaces
- `--export [formats]`: Comma-separated list for export generation
- `--fail-on-critical`: Exit with code 1 if critical issues are found
- `--format <type>`: Output format (`pretty` or `json`). Default: `pretty`
- `--log-level <level>`: Logging level (`normal`, `verbose`, `debug`). Default: `normal`

## Architecture

Crawlith is divided into workspaces:
- `packages/core`: The heavy-lifting engine (Database, Graph algorithms, Crawler, Security boundaries).
- `packages/cli`: The terminal user interface.
- `packages/web`: The React-based dashboard frontend.

All data is stored locally in an SQLite database at `~/.crawlith/crawlith.db`.

## Development

```bash
npm install
npm run build
npm run test
```

## License

MIT
