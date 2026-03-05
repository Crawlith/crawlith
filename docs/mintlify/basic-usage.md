# Basic Usage

Crawlith's primary command is `crawl`, but it offers several other tools to manage your site's data.

## `crawl` — Build a Link Graph

The `crawl` command discovers pages on your site and builds a topological map of how they link together.

<CodeGroup>
```bash npx
npx crawlith crawl https://example.com
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com
```

```bash bun
bunx crawlith crawl https://example.com
```
</CodeGroup>

By default, this will:
*   Crawl up to **500 pages**.
*   Explore to a depth of **5 clicks**.
*   Process up to **2 concurrent requests**.
*   Save results to the `./crawlith-reports` folder.

## `page` — Single Page Audit

Analyze a single URL in detail without performing a full crawl. This is useful for quickly verifying SEO or accessibility signals.

<CodeGroup>
```bash npx
npx crawlith page https://example.com/blog/hello-world
```

```bash pnpm
pnpm dlx crawlith page https://example.com/blog/hello-world
```

```bash bun
bunx crawlith page https://example.com/blog/hello-world
```
</CodeGroup>

## `sites` — List Tracked Sites

View all websites and snapshots currently stored in your local [Crawlith database](/concepts/database).

<CodeGroup>
```bash npx
npx crawlith sites
```

```bash pnpm
pnpm dlx crawlith sites
```

```bash bun
bunx crawlith sites
```
</CodeGroup>

## `ui` — Visual Dashboard

Launch the interactive, web-based dashboard to explore your site graphs.

<CodeGroup>
```bash npx
npx crawlith ui example.com
```

```bash pnpm
pnpm dlx crawlith ui example.com
```

```bash bun
bunx crawlith ui example.com
```
</CodeGroup>

## `clean` — Manage Storage

Remove specific site snapshots or entire project data to free up space.

<CodeGroup>
```bash npx
npx crawlith clean example.com
```

```bash pnpm
pnpm dlx crawlith clean example.com
```

```bash bun
bunx crawlith clean example.com
```
</CodeGroup>

## `export` — Data Portability

Export raw data from the latest completed crawl for use in third-party analysis tools.

<CodeGroup>
```bash npx
npx crawlith export example.com --format json
```

```bash pnpm
pnpm dlx crawlith export example.com --format json
```

```bash bun
bunx crawlith export example.com --format json
```
</CodeGroup>
