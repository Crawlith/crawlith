# Common Workflows

Standard ways to use Crawlith in your daily audit and monitoring tasks.

## Quick Structural Audit

Run a fast scan of the top levels of your site to assess general health:

<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --limit 200 --depth 3 --health
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --limit 200 --depth 3 --health
```

```bash bun
bunx crawlith crawl https://example.com --limit 200 --depth 3 --health
```
</CodeGroup>

*   **Goals**: Catch 404s, discover missing titles/meta, and view the high-level [Health Score](/concepts/health-score).

## In-Depth Graph Analysis

Identify your most authoritative pages and find internal link leaks:

<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --compute-pagerank --orphans --sitemap
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --compute-pagerank --orphans --sitemap
```

```bash bun
bunx crawlith crawl https://example.com --compute-pagerank --orphans --sitemap
```
</CodeGroup>

*   **Goals**: Map authority flow with [PageRank](/concepts/pagerank), find [Orphaned Pages](/concepts/orphans), and ensure [Sitemap](/features/feature-flags#--sitemap) coverage.

## Monitoring Site Changes

Compare your current site structure against a previous baseline:

<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --compare ./reports/baseline/graph.json ./reports/current/graph.json
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --compare ./reports/baseline/graph.json ./reports/current/graph.json
```

```bash bun
bunx crawlith crawl https://example.com --compare ./reports/baseline/graph.json ./reports/current/graph.json
```
</CodeGroup>

*   **Goals**: Spot newly added or removed URLs and track structural changes over time.

## CI/CD Quality Control

Integrate Crawlith into your build pipeline to prevent breaking SEO quality:

<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --fail-on-critical --limit 500
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --fail-on-critical --limit 500
```

```bash bun
bunx crawlith crawl https://example.com --fail-on-critical --limit 500
```
</CodeGroup>

*   **Goals**: Automatically fail a build if [Critical Issues](/concepts/health-score#critical-issues) like broken links or redirect loops are detected.

## Content Duplicate Detection

Spot repeating content layouts or near-duplicate sections:

<CodeGroup>
```bash npx
npx crawlith crawl https://example.com --clustering --cluster-threshold 10
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com --clustering --cluster-threshold 10
```

```bash bun
bunx crawlith crawl https://example.com --clustering --cluster-threshold 10
```
</CodeGroup>

*   **Goals**: Group structurally similar pages into [Clusters](/concepts/clustering) to audit boilerplate density.
