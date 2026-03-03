<div align="center">
  <h1>Crawlith</h1>
  <p><b>Professional-grade SEO crawling and graph intelligence suite.</b></p>

  [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
  [![Crawlith CI](https://github.com/Crawlith/crawlith/actions/workflows/ci.yml/badge.svg)]()
  [![Coverage](https://img.shields.io/badge/coverage-78%25-blue.svg)]()
  [![TypeScript](https://img.shields.io/badge/language-TypeScript-blue.svg)]()
</div>

---

## 🚀 Overview

**Crawlith** is a high-performance, deterministic SEO intelligence engine built for serious structural analysis. Unlike traditional "flat" crawlers, Crawlith treats your website as a **weighted directed graph**, allowing you to identify not just broken links, but deep architectural flaws in authority distribution, content health, and technical infrastructure.

Whether you are performing a quick on-page audit or mapping a 100k-page spider-graph, Crawlith provides the precision and depth required for modern SEO professionals.

---

## ✨ Key Features

- **🧠 Graph Intelligence**: Built-in algorithms for **PageRank**, **HITS** (Hubs/Authorities), and link-equity flow analysis.
- **🕸️ High-Performance Crawler**: BFS-based discovery engine with `robots.txt` compliance, rate limiting, and multi-threaded execution.
- **🧩 Extensible Plugin System**: A modular architecture with 15+ specialized plugins for Soft 404 detection, content clustering, orphan intelligence, and more.
- **🖥️ Premium Dashboard**: Launch a local React-based UI (`crawlith ui`) to explore your link graphs and metrics interactively.
- **🛡️ Secure & Compliant**: Enterprise-grade safety features including DNS-validated SSRF protection (`IPGuard`), redirect loop detection, and scope enforcement.
- **📊 Unified Data Layer**: Production-grade SQLite persistence enabling snapshot history, trend tracking, and incremental crawling.

---

## 🏗 Monorepo Architecture

Crawlith is organized as a pnpm-powered monorepo for maximum modularity:

| Package | Purpose |
| :--- | :--- |
| [**`@crawlith/core`**](./packages/core) | Headless engine handles crawling, graph math, and SQLite data layer. |
| [**`@crawlith/cli`**](./packages/cli) | Premium terminal interface with color-coded reports and interactive commands. |
| [**`@crawlith/web`**](./packages/web) | React + Vite dashboard for visual site-graph exploration. |
| [**`@crawlith/server`**](./packages/server) | REST API bridge connecting the headless core to visual consumers. |
| [**`@crawlith/plugins`**](./packages/plugins) | Specialized intelligence modules (PageRank, Soft404, etc). |

---

## 🚦 Quick Start

### 1. Installation
Crawlith is designed to be run globally or from your project root.

```bash
# Clone and build
git clone https://github.com/Crawlith/crawlith.git
cd crawlith
pnpm install
pnpm build
```

### 2. Basic Usage
Run a full link graph and SEO metrics audit:
```bash
crawlith crawl https://example.com --limit 1000 --depth 10
```

Analyze a specific page for on-page SEO health:
```bash
crawlith page https://example.com/blog/seo-guide
```

Launch the interactive dashboard:
```bash
crawlith ui
```

Configure a plugin (e.g., PageSpeed):
```bash
crawlith config pagespeed set YOUR_API_KEY
```

---

## 🔌 Intelligence Plugins

Crawlith ships with a suite of professional plugins:
- **`pagerank`**: Measures the relative importance of every page in the link graph.
- **`hits`**: Identifies "Hubs" (navigation) vs "Authorities" (content).
- **`soft404-detector`**: Heuristic analysis to find 200 OK pages that are actually errors.
- **`orphan-intelligence`**: Detects pages with zero internal inbound links.
- **`pagespeed`**: Integration with Google PageSpeed Insights for Core Web Vitals and Lighthouse metrics.
- **`snapshot-diff`**: Compare two crawl snapshots to see how metrics have evolved.

---

## 🛠 Development

We use `pnpm` for workspace management and `vitest` for testing.

```bash
# Run all tests with coverage
pnpm run test --coverage

# Clean and rebuild everything
pnpm run rebuild

# Lint the codebase
pnpm run lint
```

---

## 🛡 License & Safety

Crawlith is released under the **Apache License 2.0**.

**IMPORTANT**: Please ensure you have permission to crawl target domains. Crawlith respects `robots.txt` and rate limits by default. Do not use this tool for unauthorized scraping or density-testing.

---
<div align="center">
  <sub>Built with ❤️ by the Crawlith Team. Deterministic Crawl Intelligence.</sub>
</div>
