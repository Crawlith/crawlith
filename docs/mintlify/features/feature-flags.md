# Feature Flags

Control your crawl with flags to manage scope, performance, and advanced analysis.

## Core Flags

### `--depth`
Sets the maximum crawl depth from the starting URL. Use this to focus only on top-level pages.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --depth 3
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --depth 3
```

```bash bun
bunx crawlith crawl https://example.com --depth 3
```
</CodeGroup>

### `--limit`
Limits the total number of pages to crawl. Great for sampling instead of full site runs.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --limit 250
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --limit 250
```

```bash bun
bunx crawlith crawl https://example.com --limit 250
```
</CodeGroup>

### `--concurrency`
Controls how many parallel requests Crawlith makes. Higher values speed up crawling but increase site load.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --concurrency 10
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --concurrency 10
```

```bash bun
bunx crawlith crawl https://example.com --concurrency 10
```
</CodeGroup>

### `--output`
Sets the folder where reports are saved. Defaults to `./crawlith-reports`.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --output ./reports/july-audit
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --output ./reports/july-audit
```

```bash bun
bunx crawlith crawl https://example.com --output ./reports/july-audit
```
</CodeGroup>

### `--format`
Choose between `pretty` (human-readable) and `json` (machine-readable) output.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --format json
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --format json
```

```bash bun
bunx crawlith crawl https://example.com --format json
```
</CodeGroup>

## Advanced Analysis Flags

### `--health`
Runs a full health analysis post-crawl to generate your [Health Score](/concepts/health-score).
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --health
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --health
```

```bash bun
bunx crawlith crawl https://example.com --health
```
</CodeGroup>

### `--compute-pagerank`
Calculates internal [PageRank](/concepts/pagerank) scores to identify your most authoritative pages.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --compute-pagerank
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --compute-pagerank
```

```bash bun
bunx crawlith crawl https://example.com --compute-pagerank
```
</CodeGroup>

### `--compute-hits`
Computes [HITS](/concepts/hits) scores to find "Hubs" and "Authorities" on your site.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --compute-hits
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --compute-hits
```

```bash bun
bunx crawlith crawl https://example.com --compute-hits
```
</CodeGroup>

### `--clustering`
Enables [Content Clustering](/concepts/clustering) to find structurally similar page sections.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --clustering
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --clustering
```

```bash bun
bunx crawlith crawl https://example.com --clustering
```
</CodeGroup>

### `--orphans`
Identifies [Orphaned Pages](/concepts/orphans) that are in your sitemap but not linked internally.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --orphans
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --orphans
```

```bash bun
bunx crawlith crawl https://example.com --orphans
```
</CodeGroup>

### `--sitemap`
Uses your site's `sitemap.xml` as seeds to ensure full coverage.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --sitemap
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --sitemap
```

```bash bun
bunx crawlith crawl https://example.com --sitemap
```
</CodeGroup>

## Safety & Compliance

### `--ignore-robots`
Forces Crawlith to ignore `robots.txt` directives (use with caution).
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --ignore-robots
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --ignore-robots
```

```bash bun
bunx crawlith crawl https://example.com --ignore-robots
```
</CodeGroup>

### `--proxy`
Route all crawl requests through a specific proxy URL.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --proxy http://myproxy:8080
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --proxy http://myproxy:8080
```

```bash bun
bunx crawlith crawl https://example.com --proxy http://myproxy:8080
```
</CodeGroup>

### `--ua`
Customize the User-Agent string Crawlith sends to the server.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --ua "MyAuditBot/1.0"
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --ua "MyAuditBot/1.0"
```

```bash bun
bunx crawlith crawl https://example.com --ua "MyAuditBot/1.0"
```
</CodeGroup>

## Automation

### `--fail-on-critical`
Returns exit code 1 if any [critical issues](/concepts/health-score#critical-issues) are detected. Ideal for CI/CD pipelines.
<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --fail-on-critical
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --fail-on-critical
```

```bash bun
bunx crawlith crawl https://example.com --fail-on-critical
```
</CodeGroup>
