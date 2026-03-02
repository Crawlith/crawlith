# @crawlith/plugin-signals

Structured Signals Intelligence plugin for Crawlith.

## Features

- Open Graph and Twitter signal extraction
- Language + hreflang extraction
- JSON-LD parsing with broken-block detection
- Snapshot-scoped SQLite persistence (`signals` table)
- Authority-aware post-crawl signal scoring and issue ranking

## Usage

```bash
crawlith crawl https://example.com --signals
crawlith page https://example.com --signals --live
```

## Output

When enabled, results include `plugins.signals` with:

- Coverage metrics (OG, language, hreflang, JSON-LD)
- Signals score (0-100)
- High/medium/low impact fix queues
- High-authority pages missing schema
- Schema and OG clustering insights
