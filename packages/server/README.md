# @crawlith/server 🌐

> **RESTful API layer for the Crawlith intelligence engine.**

`@crawlith/server` acts as the bridge between the headless **Crawlith** [core](../core) and interactive consumer applications like the [web dashboard](../web). It provides a standard interface for managing crawl snapshots, retrieving graph data, and inspecting SEO analysis results.

---

## ✨ Features

- **📡 REST Endpoints**: Standardized API for snapshots, sites, and page metrics.
- **📊 Graph Delivery**: Efficiently stream large link graphs to the frontend.
- **🛠 Snapshot Management**: List, delete, and compare historical crawl data.
- **🔌 Plugin-Ready**: Exposes plugin-generated data through custom API responses.
- **🚀 Local-First**: Optimized for running alongside the CLI on a local machine.

---

## 🏗 Endpoints (Selected)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/sites` | List all tracked domains in the database. |
| `GET` | `/api/sites/:domain/snapshots` | Get historical snapshots for a site. |
| `GET` | `/api/snapshots/:id/graph` | Fetch the full link graph for a snapshot. |
| `GET` | `/api/snapshots/:id/metrics` | Retrieve aggregated SEO health and HITS metrics. |
| `GET` | `/api/snapshots/:id/analyze` | Returns full on-page analysis for the snapshot. |

---

## 🛠 Usage (Express Middleware)

If you are building your own tools, the server is designed to be easily embedded as middleware:

```typescript
import express from 'express';
import { attachCrawlithRouter } from '@crawlith/server';

const app = express();
attachCrawlithRouter(app);

app.listen(3000, () => {
  console.log('Crawlith API running on http://localhost:3000');
});
```

---

## 🛡 License

Apache License 2.0 © [Crawlith](https://github.com/Crawlith)
