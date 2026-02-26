# Feature Flags

Use flags to control crawl scope, output, and issue detection.

## Core flags

### `--depth`

Sets the maximum crawl depth from the starting URL.

Use this to keep crawls focused on top-level pages.

```bash
crawlith sitegraph https://example.com --depth 3
```

Expected behavior: Crawl results include pages up to the specified depth.

### `--limit`

Sets the maximum number of pages to crawl.

This is useful when you want a quick sample instead of a full-site run.

```bash
crawlith sitegraph https://example.com --limit 250
```

Expected behavior: The crawl stops when it reaches the page limit.

### `--concurrency`

Controls how many pages Crawlith requests at the same time.

Higher values can speed up crawls, but may increase load on the target site.

```bash
crawlith sitegraph https://example.com --concurrency 10
```

Expected behavior: Crawl speed and request parallelism adjust based on the value.

### `--output`

Sets the folder where Crawlith writes crawl files.

Use this when you want to separate reports by project or date.

```bash
crawlith sitegraph https://example.com --output ./reports/july-audit
```

Expected behavior: Output files are written to the folder you provide.

### `--format`

Chooses output format.

Use this to generate data in the format your workflow expects.

```bash
crawlith sitegraph https://example.com --format json
```

Expected behavior: Crawlith writes output in the selected format.

## Crawl intelligence flags

### `--incremental`

Runs an incremental crawl instead of a full recrawl.

Use this to focus on pages that changed since the last crawl.

```bash
crawlith sitegraph https://example.com --incremental
```

Expected behavior: Crawlith updates crawl output using prior crawl context.

### `--compare old.json new.json`

Compares two crawl snapshots.

This helps you see added, removed, or changed URLs between runs.

```bash
crawlith sitegraph https://example.com --compare ./baseline/crawl.json ./latest/crawl.json
```

Expected behavior: Crawlith generates a diff-style output file for crawl changes.

### `--sitemap`

Uses sitemap URLs as crawl seeds.

This helps discover important URLs quickly.

```bash
crawlith sitegraph https://example.com --sitemap
```

Expected behavior: Sitemap URLs are included early in crawl discovery.

### `--detect-duplicates`

Enables duplicate-content detection.

Use this to spot pages with very similar or repeated content.

```bash
crawlith sitegraph https://example.com --detect-duplicates
```

Expected behavior: Output includes duplicate-content findings.

### `--detect-soft404`

Enables soft 404 detection.

Use this to identify pages that appear successful but behave like missing pages.

```bash
crawlith sitegraph https://example.com --detect-soft404
```

Expected behavior: Output includes potential soft 404 URLs.

### `--detect-canonicals`

Checks canonical URL signals.

Use this to find missing, conflicting, or unexpected canonical patterns.

```bash
crawlith sitegraph https://example.com --detect-canonicals
```

Expected behavior: Output includes canonical-related findings.

### `--detect-broken-links`

Enables broken internal link checks.

Use this to identify links that lead to error pages.

```bash
crawlith sitegraph https://example.com --detect-broken-links
```

Expected behavior: Output includes broken-link URLs and sources.

### `--detect-redirects`

Enables redirect detection for crawled links.

Use this to locate redirecting URLs that may slow navigation.

```bash
crawlith sitegraph https://example.com --detect-redirects
```

Expected behavior: Output includes redirecting URLs and targets.

### `--detect-traps`

Enables crawl trap detection.

Use this to find URL patterns that can create near-infinite crawl paths.

```bash
crawlith sitegraph https://example.com --detect-traps
```

Expected behavior: Output includes suspected crawl-trap patterns.
