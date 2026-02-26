# @crawlith/cli 🚀

> **Deterministic crawl intelligence engine for serious SEO analysis.**

`@crawlith/cli` is the command-line interface for **Crawlith**, a modular SEO crawling engine built for depth, accuracy, and professional analysis. It goes beyond simple "broken link checking" by calculating PageRank, HITS scores, detecting content clusters, and analyzing transport-layer security.

---

## ✨ Features

- **🌐 Deep Crawling**: Multi-threaded, robots.txt compliant crawler with depth and page limits.
- **🧠 Graph Intelligence**: Calculates PageRank, Hub/Authority scores (HITS), and maps internal link structures.
- **🧩 Content Clustering**: Detects duplicate or near-duplicate content clusters using advanced hashing.
- **🔒 Security Probing**: Deep inspection of SSL/TLS configurations and HTTP transport layer.
- **📈 Advanced Scoring**: Unified SEO signals for on-page structure, thin content, and crawl efficiency.
- **🖥️ Dashboard Integration**: Instantly launch a local web UI to visualize complex crawl data.

---

## 📦 Installation

To use Crawlith globally on your system:

```bash
npm install -g @crawlith/cli
# or
pnpm add -g @crawlith/cli
```

Or run it instantly without installation using `npx`:

```bash
npx crawlith --help
```

---

## 🛠 Usage

### 1. Crawl a Website
Build a full link graph and SEO metrics for a domain.
```bash
crawlith crawl https://example.com --limit 1000 --depth 10
```

### 2. Analyze a Single Page
Perfect for quick on-page SEO audits and content structure checks.
```bash
crawlith page https://example.com/blog/seo-guide
```

### 3. Start the UI Dashboard
Visualize your crawl snapshots in a beautiful, interactive interface.
```bash
crawlith ui
```

### 4. Probe Security
Inspect transport-layer headers, SSL/TLS status, and HTTP/2 support.
```bash
crawlith probe https://example.com
```

### 5. List Tracked Sites
View all sites currently stored in your local intelligence database.
```bash
crawlith sites
```

---

## 📊 Why Crawlith CLI?

Traditional crawlers give you a flat list of errors. Crawlith treats your website as a **graph**, allowing you to identify:
- **Orphan Pages**: Automatic detection of pages that have no internal inbound links.
- **Authority Sinks**: Identify pages that capture authority but fail to distribute it effectively.
- **Link Roles**: Understand which pages act as "Hubs" (navigational) vs "Authorities" (content-rich).
- **Deterministic Analysis**: Reproducible crawls that ensure your metrics are consistent over time.

---

## ⌨️ Command Options

| Option | Description |
| :--- | :--- |
| `-l, --limit <n>` | Maximum number of pages to crawl |
| `-d, --depth <n>` | Maximum click depth from the start URL |
| `--export [type]` | Export results to `json`, `markdown`, `csv`, or `html` |
| `--ignore-robots` | Bypass robots.txt directives (use responsibly) |
| `--sitemap` | Explicitly use a sitemap for discovery |

---

## 🛡 License

MIT © [Crawlith](https://github.com/Crawlith)
