# @crawlith/plugin-signals

Structured Signals Intelligence plugin for Crawlith.

## Features

- Open Graph and Twitter signal extraction
- Language + hreflang extraction
- JSON-LD parsing with broken-block detection
- Scoped per-page persistence using `ctx.db.data.getOrFetch`
- Snapshot-level issue prioritization in `plugins.signals`

## Usage

```bash
crawlith crawl https://example.com --signals
crawlith page https://example.com --signals --live
```
