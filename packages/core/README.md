# @crawlith/core 🧠

> **The headless intelligence engine at the heart of Crawlith.**

`@crawlith/core` provides the foundational logic for the **Crawlith** ecosystem. It is a high-performance, deterministic library for crawling websites, building weighted internal link graphs, and calculating advanced SEO metrics like PageRank and Hub/Authority scores.

---

## ✨ Features

- **🕸️ Graph-Based Crawler**: Treats websites as mathematical graphs, not just a list of URLs.
- **🔢 Advanced Algorithms**: Built-in support for **PageRank**, **HITS**, and **Duplicate Detection**.
- **🔍 SEO Analysis**: Integrated on-page audits (Titles, Meta, H1s, Thin Content detection).
- **💾 Persistent Storage**: Efficient data layer using `better-sqlite3` for local intelligence.
- **🧩 Plugin Architecture**: Highly extensible hook system for custom crawling and metrics.
- **⚡ Performance First**: Multi-threaded with `p-limit` and optimized for large datasets.

---

## 🏗 Modular Architecture

The core is divided into independent specialized modules:

| Module | Responsibility |
| :--- | :--- |
| **`crawler`** | Manages HTTP fetching, robots.txt compliance, and discovery. |
| **`graph`** | Link structure management, graph algorithms, and metrics. |
| **`scoring`** | Calculates on-page SEO health and content authority scores. |
| **`analysis`** | Deep content inspection, metadata extraction, and clustering. |
| **`db`** | SQLite-based repository layer for snapshots and snapshots. |
| **`plugin-system`** | Lifecycle hooks and plugin registry management. |

---

## 🛠 Usage (Library)

While most users interact with Crawlith through the [CLI](../cli), you can use the core directly in your Node.js applications:

```typescript
import { CrawlSitegraph } from '@crawlith/core';

const engine = new CrawlSitegraph();
const result = await engine.execute({
  url: 'https://example.com',
  limit: 100,
  depth: 5
});

console.log(`Crawl complete. Snapshot ID: ${result.snapshotId}`);
console.log(`Nodes in graph: ${result.graph.nodes.size}`);
```

---

## 🔌 Hook System

Extend the engine's behavior by tapping into the lifecycle:

- `onInit`: Setup before crawling starts.
- `onCrawlStart`: Triggered when first URL is enqueued.
- `onPageParsed`: Intercept page data after parsing.
- `onGraphBuilt`: Access the complete link graph.
- `onMetrics`: Modify or augment calculated metrics.
- `onReport`: Transform final output results.

---

## 🛡 License

Apache License 2.0 © [Crawlith](https://github.com/Crawlith)
