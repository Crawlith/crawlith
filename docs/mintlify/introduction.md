# Introduction

Welcome to **Crawlith**, the modular crawl intelligence engine designed for deterministic SEO analysis, site health monitoring, and link graph exploration.

Crawlith goes beyond simple crawling. It builds a topological map of your website, calculates authority flow using [PageRank](/concepts/pagerank), and identifies structural issues like [crawl traps](/concepts/crawl-traps) and [orphaned pages](/concepts/orphans).

## Why use Crawlith?

*   **Graph Intelligence**: Understand your site's structure through link topology, not just flat lists of URLs.
*   **Health Scoring**: Get an instant [Health Score](/concepts/health-score) (0-100) based on weighted SEO heuristics.
*   **Production Ready**: Built for massive sites with resilient local storage and safety features like SSRF protection.
*   **AI Integration**: Built-in support for AI agents through the [Model Context Protocol (MCP)](/workflows/ai-integration).

## Quick Start

Ready to see your site's structure? Run your first crawl in seconds:

```bash
crawlith crawl https://example.com
```

This will crawl up to 500 pages of `https://example.com` and generate a summary report.

## Supported Platforms

Crawlith is a Node.js-based CLI that runs anywhere you can install JavaScript packages:

*   **macOS / Linux**: Fully supported.
*   **Windows**: Supports PowerShell, Command Prompt, and WSL.
*   **CI/CD**: Optimized for GitHub Actions, GitLab CI, and Jenkins.
