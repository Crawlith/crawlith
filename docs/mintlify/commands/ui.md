# ui

The `ui` command launches the interactive, web-based dashboard for visualizing and deep-diving into your crawl data.

## Usage

```bash
crawlith ui <domain> [options]
```

## Description

The dashboard provides a premium experience for exploring:
- **Structure Graph**: A zoomable, interactive D3 layout of your internal links.
- **Trend Charts**: Historical tracking of Health Scores and page counts.
- **Issue Explorer**: Filterable lists of broken links, duplicate content, and orphaned pages.

## Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--port <n>` | Custom port for the dashboard server. | `3000` |
| `--no-open` | Start the server without automatically opening the browser. | - |
