# Common Workflows

## Quick audit

```bash
crawlith sitegraph https://example.com --limit 200 --depth 3
```

Runs a fast crawl of top pages so you can review site health quickly.

## Incremental crawl

```bash
crawlith sitegraph https://example.com --incremental
```

Updates your crawl using previous results, which is helpful for regular monitoring.

## Comparing two crawls

```bash
crawlith sitegraph https://example.com --compare ./reports/baseline/crawl.json ./reports/latest/crawl.json
```

Compares two crawl snapshots to show what changed.

## Finding broken links

```bash
crawlith sitegraph https://example.com --detect-broken-links
```

Finds internal links that point to unavailable pages.

## Detecting duplicate content

```bash
crawlith sitegraph https://example.com --detect-duplicates
```

Highlights pages that may repeat or overlap heavily in content.
