# Orphaned Pages

**Orphaned Pages** are URLs that exist on your website but have **no internal links** pointing to them from other pages.

## How it works

Crawlith identifies orphans by comparing your `sitemap.xml` with your crawl data:

1.  **Sitemap Discovery**: Crawlith reads all URLs listed in your sitemap.
2.  **Crawl Discovery**: Crawlith starts from your homepage and follows all internal links.
3.  **Comparison**: Any URL that is in the sitemap but was **not reached** during the crawl is flagged as an orphan.

## Why it matters

Orphaned pages present several issues:
*   **Wasted Equity**: No internal [PageRank](/concepts/pagerank) flows to these pages, making them much less likely to rank.
*   **Poor UX**: Users have no way to navigate to these pages naturally.
*   **Partial Indexing**: While search engines may discover them via the sitemap, they often treat them as lower priority.

## Severity Scoring

Crawlith applies a severity score (low/medium/high) to each orphan:
*   **High Severity**: Important landing pages (defined by depth or content) that are missing links.
*   **Soft Orphans**: Pages with **only one or two** inbound links (configurable with `--min-inbound`).

## Usage

Enable orphan detection during a crawl with the `--orphans` flag:

```bash
crawlith crawl https://example.com --sitemap --orphans
```

The CLI will list all discovered orphans and their severity in the final report.
