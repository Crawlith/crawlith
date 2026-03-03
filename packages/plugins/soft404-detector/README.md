# 🕵️ Soft 404 Detector Plugin

The **Soft 404 Detector** plugin automatically analyzes site pages to detect "Soft 404" responses—pages that return a HTTP `200 OK` status code but conceptually behave like an error page (e.g., stating "Page Not Found", lacking content, or providing no outbound navigation).

It scores pages between `0.0` and `1.0` and outputs detailed reasoning regarding *why* the page triggered an alert. As a registered **Score Provider** natively mapped into Crawlith's core, its analyses are aggregated continuously across the crawl footprint.

## Features

- **Text Pattern Matching:** Flags `<title>` tags and `<h1>` headers containing error phrases (e.g., `not found`, `error`, `unavailable`).
- **Body Context Extraction:** Detects explicit in-text error declarations (e.g., "page not found").
- **Content Density Checking:** Severely low word counts (< 50 words) heavily increase the soft 404 probability.
- **Link Isolation:** Flags pages acting as dead-ends, lacking any outbound links entirely.
- **Smart Caching (`fetchMode: 'local'`):** Computes entirely on the local device, safely executing against previously downloaded `html` payloads, supporting instant execution during `page` and `crawl` snapshot pipelines without re-triggering remote requests unless bypassing cache thresholds (`--live`).

## Usage

Enable the plugin via the CLI using the `--detect-soft404` flag.

### Command Line Interface

```bash
# Analyze a single page locally for Soft 404 violations
crawlith page --detect-soft404 https://example.com/missing-product

# Deep crawl a fully site, scanning all discovered URLs for Soft 404 structures
crawlith crawl --detect-soft404 https://example.com
```

## Output & Interpretation

### Single Page (`page` command)
For specific URL lookups, the plugin outputs a simple terminal read-out on execution:
```plaintext
[Soft404] https://example.com/broken-page | Score: 1.0 | Reason: title_contains_not found, h1_contains_404, very_low_word_count
```

### Full Site Crawl JSON Output (`crawl` command)
During extensive crawls, nodes heavily penalized map into the JSON reporter object (`--format json` or `--export json`):

```json
{
  "plugins": {
    "soft404": {
      "totalDetected": 3,
      "topSample": [
        {
          "url": "https://example.com/missing",
          "score": 0.8
        }
      ]
    }
  }
}
```

The plugin also explicitly injects `soft404Score` directly onto graph `Node` objects, enabling graph algorithms to dynamically down-weight links originating from dead-end error patterns.

## Architecture Guidelines

This plugin strictly implements the [AI Agent Guide's](../../../docs/plugins/ai-agent-guide.md) architectural standards:
- All business logic lives inside a standalone `Soft404Service` object (`src/Service.ts`).
- Storage leverages the `ctx.db.data.getOrFetch` fluent API.
- Implements `scoreProvider: true` natively inside its manifest for top-level aggregation logic.
