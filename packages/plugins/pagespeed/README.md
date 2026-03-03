# @crawlith/plugin-pagespeed

Professional PageSpeed Insights integration for Crawlith. This plugin allows you to attach Lighthouse performance metrics and Core Web Vitals data directly to your page analysis reports.

## ✨ Features

- **🚀 Performance Metrics**: Extracts LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift), and TBT (Total Blocking Time).
- **📊 Core Web Vitals**: Instant "PASS/FAIL" assessment based on real-world field data.
- **⚡ Smart Caching**: Automatically caches API responses for 24 hours to prevent redundant API usage and stay within quota.
- **🛡️ Secure Configuration**: Uses Crawlith's encrypted configuration utility to store your Google API key safely on disk.

## 🚦 Setup

Before using the plugin, you must configure your Google PageSpeed Insights API key.

```bash
crawlith config pagespeed set YOUR_GOOGLE_API_KEY
```

> [!NOTE]
> Your API key is encrypted using AES-256-GCM with machine-specific identifiers (hostname + username). It is stored in `~/.crawlith/config.json` and is not portable across different machines.

## 📖 Usage

Attach a PageSpeed report to a standard page analysis:

```bash
crawlith page https://example.com --pagespeed
```

### Options

| Flag | Description |
| :--- | :--- |
| `--pagespeed` | Triggers a PageSpeed Insights audit (using 'mobile' strategy). |
| `--force` | Bypasses the 24-hour cache and forces a fresh API request. |

## ⚙️ How It Works

1. **Configuration**: When you run the `config` command, the plugin saves your key using the `@crawlith/core` secure config utility.
2. **Execution**: During the `onReport` hook of the `page` command:
    - It validates that the URL exists in a crawl snapshot.
    - It checks the local SQLite database for a cached result from the last 24 hours.
    - If no cache exists (or `--force` is used), it fetches fresh data from the Google API.
3. **Persistence**: Full JSON payloads and summarized metrics are stored in the `plugin_pagespeed` table for historical reporting.
4. **Reporting**: Compact metrics are printed to the terminal, and the structured data is included in the final JSON/Insight report.

---
<div align="center">
  <sub>Part of the Crawlith Plugin Ecosystem.</sub>
</div>
