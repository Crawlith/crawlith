# Health Score

**Health Score** is a single, representative metric from 0 to 100 that summarizes your website's structural and technical quality.

## How it works

Crawlith calculates your score after a crawl by weighting several categories of checks:

1.  **Critical Issues**: Broken links, server errors, and [crawl traps](/concepts/crawl-traps). These have the highest negative impact on your score.
2.  **SEO Fundamentals**: Missing titles, meta descriptions, or H1 tags.
3.  **Content Quality**: Word counts, text-to-HTML ratios, and thin content detection.
4.  **Structure**: Redirect chains, canonical errors, and [orphaned pages](/concepts/orphans).

## Score Categories

*   **90 - 100 (Excellent)**: No critical issues and highly optimized structure.
*   **70 - 89 (Good)**: Generally sound structure, but some technical warnings exist.
*   **50 - 69 (Fair)**: Multiple technical issues that need attention soon.
*   **0 - 49 (Critical)**: Major structural blockers found that require immediate fixing.

## Why it matters

A clear score helps teams:
*   **Benchmark Quality**: Measure site health before and after significant updates.
*   **Automate Audits**: Use `--fail-on-critical` in CI/CD pipelines to block releases if the score drops.
*   **Prioritize Tasks**: Focus first on the issues that are dragging the score down the most.

## Usage

Health scoring is enabled by default during crawl:

```bash
crawlith crawl https://example.com
```

The CLI will print a summary table of the score breakdown upon completion.
