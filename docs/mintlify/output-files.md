# Output Files

Crawlith generates several types of reports in your specified output directory (defaults to `./crawlith-reports`).

## Primary Reports

### `graph.json`
The standard crawl snapshot containing all discovered URLs, internal links, and technical metadata. This is the primary file used for [Snapshot Comparison](/workflows/common-workflows#comparing-two-crawls).

### `metrics.json`
A computed data file containing high-level summaries, [Health Scores](/concepts/health-score), and [PageRank](/concepts/pagerank) values.

## Visual & Human Reports

### `crawl.html` (Interactive)
The primary visual report. It features a D3.js interactive link graph where node size represents [PageRank authority](/concepts/pagerank) and color indicates [Health Score](/concepts/health-score).
*   **Generate with**: `crawlith crawl <url> --visualize`

### `summary.md` (Markdown)
A concise text-based audit summary. Perfect for adding to GitHub PR comments or as part of a project README.
*   **Generate with**: `crawlith crawl <url> --markdown`

### `graph.html` (Static)
A lightweight HTML report for environments where interactive visualization isn't required.

## Export & Data Analysis

### `nodes.csv` and `edges.csv`
Tabular data exports. Ideal for importing into Excel, Google Sheets, or graph analysis software like Gephi.
*   **Generate with**: `crawlith crawl <url> --csv`

### `crawlith-export-*.json`
A single-file data bundle produced by the `crawlith export` command. This is the recommended format for machine-to-machine integrations.

## Internal Storage

### `crawlith.db`
Located at `~/.crawlith/crawlith.db`, this is your local site history database. You do not need to interact with this file directly, but it's where Crawlith stores all project and snapshot metadata.
