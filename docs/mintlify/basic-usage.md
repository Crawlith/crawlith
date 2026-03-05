# Basic Usage

Crawlith is designed around a set of specialized commands. This page gives you a high-level overview of what each command does.

## Primary Commands

### [crawl](/commands/crawl) — Build a Link Graph
The core command for discovering pages and building a topological map of your site.
```bash
crawlith crawl https://example.com
```

### [page](/commands/page) — Single Page Audit
Perform a real-time, deep audit of a specific URL for SEO and accessibility.
```bash
crawlith page https://example.com/about
```

### [ui](/commands/ui) — Visual Dashboard
Launch the interactive web dashboard to explore your site graphs.
```bash
crawlith ui example.com
```

## Management Commands

### [sites](/commands/sites) — List Projects
View all tracked websites and their latest crawl summaries.
```bash
crawlith sites
```

### [export](/commands/export) — Data Portability
Extract raw data from the database into JSON or CSV formats.
```bash
crawlith export example.com
```

### [clean](/commands/clean) — Manage Storage
Remove old snapshots or entire projects from your local database.
```bash
crawlith clean example.com
```

### [config](/commands/config) — Secure Settings
Manage API keys and other encrypted configuration values.
```bash
crawlith config pagespeed set YOUR_KEY
```
