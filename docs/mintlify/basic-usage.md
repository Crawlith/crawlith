# Basic Usage

Crawlith's primary command is `crawl`, but it offers several other tools to manage your site's data.

## `crawl` — Build a Link Graph

The `crawl` command discovers pages on your site and builds a topological map of how they link together.

```bash
crawlith crawl https://example.com
```

By default, this will:
*   Crawl up to **500 pages**.
*   Explore to a depth of **5 clicks**.
*   Process up to **2 concurrent requests**.
*   Save results to the `./crawlith-reports` folder.

## `page` — Single Page Audit

Analyze a single URL in detail without performing a full crawl. This is useful for quickly verifying SEO or accessibility signals.

```bash
crawlith page https://example.com/blog/hello-world
```

## `sites` — List Tracked Sites

View all websites and snapshots currently stored in your local [Crawlith database](/concepts/database).

```bash
crawlith sites
```

## `ui` — Visual Dashboard

Launch the interactive, web-based dashboard to explore your site graphs.

```bash
crawlith ui example.com
```

## `clean` — Manage Storage

Remove specific site snapshots or entire project data to free up space.

```bash
crawlith clean example.com
```

## `export` — Data Portability

Export raw data from the latest completed crawl for use in third-party analysis tools.

```bash
crawlith export example.com --format json
```
