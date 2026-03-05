# HITS (Hubs & Authorities)

The **HITS** (Hyperlink-Induced Topic Search) algorithm is a link analysis method used by Crawlith to identify two specific types of important pages on your site: **Hubs** and **Authorities**.

## How it works

Unlike [PageRank](/concepts/pagerank), which assigns a single importance score, HITS assigns two scores to every page:

1.  **Authority Score**: A page is a good *authority* if it is linked to by many good hubs. These are usually destination pages with high-value content.
2.  **Hub Score**: A page is a good *hub* if it links to many good authorities. These are typically navigation pages, category indexes, or curated resource lists.

## Why it matters

Understanding Hubs and Authorities helps you:
- **Improve Navigation**: Identify high-value "Hubs" that should be optimized to guide users to key content.
- **Discover Content Leaders**: See which pages are naturally acting as the primary authorities in your site's hierarchy.
- **Structure Auditing**: Ensure that your intended "Landing Pages" have high authority scores and your "Category Pages" have high hub scores.

## Usage

Enable HITS calculation during a crawl using the `--compute-hits` flag:

```bash
crawlith crawl https://example.com --compute-hits
```

Results are included in the `metrics.json` export and available for deep-dive analysis in the [Visual Dashboard](/basic-usage#ui-visual-dashboard).
