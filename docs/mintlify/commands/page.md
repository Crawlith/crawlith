# page

The `page` command performs a real-time, deep audit of a single URL. It is designed for granular analysis of content, technical SEO, and accessibility signals.

## Usage

```bash
crawlith page <url> [options]
```

## Core Options

| Flag | Description |
| :--- | :--- |
| `--live` | Perform a fresh network fetch before analysis. If omitted, Crawlith uses the latest database record. |
| `--seo` | Filter output to only show SEO-specific findings (Title, Meta, etc.). |
| `--content` | Filter output to only show Content findings (Word count, Ratios). |
| `--accessibility` | Filter output to only show Accessibility findings (Alt tags, Headings). |

## Integration Flags

| Flag | Description |
| :--- | :--- |
| `--pagespeed` | Attach a **Google PageSpeed Insights** report. |
| `--force` | Bypass the 24-hour cache and force a new PageSpeed API request. |
| `--signals` | Include social metadata (OG/Twitter) and structured data coverage. |

## Network Options

| Flag | Description |
| :--- | :--- |
| `--proxy <url>` | Use a proxy server for the page request. |
| `--ua <string>` | Custom User-Agent string. |
| `--timeout <ms>` | Request timeout in milliseconds (Default: 10000). |
