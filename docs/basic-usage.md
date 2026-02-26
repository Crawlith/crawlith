# Basic Usage

The main command is:

```bash
crawlith crawl <url>
```

## What it does

`crawlith crawl` crawls pages on the target site and builds an internal link graph.

## What it outputs

After a crawl, Crawlith writes report files to your output folder.

By default, files are saved in `./crawlith-reports`.

## Insight-First Reporting

Crawlith now provides an "Insight-First" output by default. This groups results into:
- **Health Score**: A weighted score from 0-100 based on site quality.
- **CRITICAL**: Issues that need immediate fixing (e.g., broken links, redirect chains).
- **WARNINGS**: SEO improvements (e.g., missing descriptions, thin content).
- **OPPORTUNITIES**: Internal linking and authority growth suggestions.

## JSON output

Crawlith can generate a full structured JSON report using the `--json` flag. This is useful for CI/CD pipelines and automated analysis.

```bash
crawlith crawl https://example.com --json
```

## CI/CD Integration

Use the `--fail-on-critical` flag to make the CLI exit with code 1 if any critical issues are detected.

```bash
crawlith crawl https://example.com --fail-on-critical
```

## Examples

```bash
crawlith crawl https://example.com
```

```bash
crawlith crawl https://example.com --output ./reports/example --visualize
```

## Exporting Snapshots

To export the raw data from the latest completed crawl in the database to a JSON file:

```bash
crawlith export https://example.com -o snapshot.json
```

This includes all discovered nodes, edges, and calculated metrics.
