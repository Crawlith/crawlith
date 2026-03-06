# crawl

The `crawl` command is the heart of Crawlith. It performs a Breadth-First Search (BFS) traversal of a website, builds a topological link graph, and runs advanced analysis modules.

## Usage

```bash
crawlith crawl <url> [options]
```

## Core Traversal Flags

These options control how the crawler moves through your site.

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--limit <n>` | Stop crawling after `n` unique pages are reached. | `500` |
| `--depth <n>` | Maximum click distance from the starting URL. | `5` |
| `--concurrency <n>` | Number of parallel requests to send to the server. | `2` |
| `--no-query` | Treat `url?a=1` and `url?a=2` as the same page by stripping params. | - |
| `--sitemap [url]` | Seed the crawl queue with URLs found in your XML sitemap. | `/sitemap.xml` |

## Advanced Intelligence Flags

Enable specialized analysis modules to gain deeper insights into your site's structure.

| Flag | Description | Concept Link |
| :--- | :--- | :--- |
| `--compute-pagerank` | Measure internal authority flow and link equity. | [PageRank](/concepts/pagerank) |
| `--compute-hits` | Identify key Hubs and Authorities. | [HITS](/concepts/hits) |
| `--clustering` | Group pages with similar structural layouts. | [Clustering](/concepts/clustering) |
| `--orphans` | Find pages in sitemap with zero internal links. | [Orphaned Pages](/concepts/orphans) |
| `--heading` | Audit H1-H6 hierarchy and nesting health. | - |
| `--signals` | Extract social tags (OG/Twitter) and JSON-LD. | - |
| `--incremental` | Recrawl only pages that have changed since the last run. | - |
| `--detect-duplicates` | Spot pages with very similar or repeated content. | - |
| `--detect-soft404` | Identify "fake" 200 OK responses that should be 404s. | - |
| `--detect-canonicals` | Find missing, conflicting, or incorrect canonical tags. | - |
| `--detect-broken-links` | Map all internal links pointing to non-200 pages. | - |
| `--detect-redirects` | Identify redirect chains and loops. | - |
| `--detect-traps` | Detect URL patterns that create infinite crawl loops. | - |

## Multi-Snapshot Flags

| Flag | Description |
| :--- | :--- |
| `--compare <old> <new>` | Generate a diff report between two JSON snapshot files. |

## Safety & Compliance Flags

| Flag | Description |
| :--- | :--- |
| `--proxy <url>` | Route all traffic through a specified proxy server. |
| `--ua <string>` | Override the default `crawlith` user-agent string. |
| `--rate <n>` | Limit the maximum requests per second (TPS). |
| `--timeout <ms>` | Maximum wait time for a server response (Default: 10000). |
| `--ignore-robots` | Disregard `robots.txt` directives. |
| `--max-bytes <n>` | Do not download pages larger than `n` bytes. |
| `--max-redirects <n>` | Maximum redirect hops before giving up (Default: 5). |

## Output & Automation Flags

| Flag | Description |
| :--- | :--- |
| `--export <fmts>` | Comma-separated list: `json,csv,markdown,html,visualize`. |
| `--output <path>` | Custom directory for all generated report files. |
| `--fail-on-critical` | Exit with code 1 if critical issues (like 404s) are found. |
| `--score-breakdown` | Show detailed weighting for the Health Score calculation. |

Health score is computed automatically on every crawl and persisted to the snapshot.
