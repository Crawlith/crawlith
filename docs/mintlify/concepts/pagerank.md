# PageRank

**PageRank** is an algorithm used by Crawlith to measure the relative internal importance of every page on your website based on its linking structure.

## How it works

Crawlith treats your website as a mathematical graph where each page is a **node** and each link is a **directed edge**. 

1.  **Link Equity**: When Page A links to Page B, it "votes" for Page B's importance.
2.  **Transferred Authority**: The more authoritative Page A is, the more importance it transfers to Page B.
3.  **Iterative Scoring**: Crawlith runs multiple passes over your link graph until the scores stabilize.

## Why it matters

Understanding your internal PageRank helps you:
*   Identify **Authoritative Pages**: See which pages are naturally "powerful" in your current structure.
*   Find **Leakage**: Spot high-authority pages that don't link to your important landing pages.
*   Optimize **Internal Equity**: Ensure that your most important content receives the most link equity.

## Usage

Enable PageRank calculation during a crawl using the `--compute-pagerank` flag:

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

Results are stored in `metrics.json` and visualized in the [Structure Graph](/basic-usage#ui-visual-dashboard).
