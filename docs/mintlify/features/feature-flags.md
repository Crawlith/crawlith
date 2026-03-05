# Feature Flags

Control your crawl with flags to manage scope, performance, and advanced analysis.

## Core Flags

### `--depth`
Sets the maximum crawl depth from the starting URL. Use this to focus only on top-level pages.
```bash
crawlith crawl https://example.com --depth 3
```

### `--limit`
Limits the total number of pages to crawl. Great for sampling instead of full site runs.
```bash
crawlith crawl https://example.com --limit 250
```

### `--concurrency`
Controls how many parallel requests Crawlith makes. Higher values speed up crawling but increase site load.
```bash
crawlith crawl https://example.com --concurrency 10
```

### `--output`
Sets the folder where reports are saved. Defaults to `./crawlith-reports`.
```bash
crawlith crawl https://example.com --output ./reports/july-audit
```

### `--format`
Choose between `pretty` (human-readable) and `json` (machine-readable) output.
```bash
crawlith crawl https://example.com --format json
```

## Advanced Analysis Flags

### `--health`
Runs a full health analysis post-crawl to generate your [Health Score](/concepts/health-score).
```bash
crawlith crawl https://example.com --health
```

### `--compute-pagerank`
Calculates internal [PageRank](/concepts/pagerank) scores to identify your most authoritative pages.
```bash
crawlith crawl https://example.com --compute-pagerank
```

### `--compute-hits`
Computes [HITS](/concepts/hits) scores to find "Hubs" and "Authorities" on your site.
```bash
crawlith crawl https://example.com --compute-hits
```

### `--clustering`
Enables [Content Clustering](/concepts/clustering) to find structurally similar page sections.
```bash
crawlith crawl https://example.com --clustering
```

### `--orphans`
Identifies [Orphaned Pages](/concepts/orphans) that are in your sitemap but not linked internally.
```bash
crawlith crawl https://example.com --orphans
```

### `--sitemap`
Uses your site's `sitemap.xml` as seeds to ensure full coverage.
```bash
crawlith crawl https://example.com --sitemap
```

## Safety & Compliance

### `--ignore-robots`
Forces Crawlith to ignore `robots.txt` directives (use with caution).
```bash
crawlith crawl https://example.com --ignore-robots
```

### `--proxy`
Route all crawl requests through a specific proxy URL.
```bash
crawlith crawl https://example.com --proxy http://myproxy:8080
```

### `--ua`
Customize the User-Agent string Crawlith sends to the server.
```bash
crawlith crawl https://example.com --ua "MyAuditBot/1.0"
```

## Automation

### `--fail-on-critical`
Returns exit code 1 if any [critical issues](/concepts/health-score#critical-issues) are detected. Ideal for CI/CD pipelines.
```bash
crawlith crawl https://example.com --fail-on-critical
```
