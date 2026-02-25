# Crawlith - AI Agent Instructions

Hello, Agent! You are working on **Crawlith**, a high-performance, lightweight SEO Link Graph and Site Analysis tool written in Node.js and TypeScript. It provides deep structural analysis of internal linking, content quality, and technical SEO health via a premium CLI and interactive HTML reports.

When operating in this codebase, you **MUST** adhere to the following rules, architecture constraints, and workflows.

## 🎯 1. Core Architecture & Philosophy
- **Crawler**: Always use BFS-based (Breadth-First Search) approaches for shortest-path discovery.
- **Graph Engine**: Rely on the in-memory Map/Set structure for efficient link deduplication and metric calculation (Authority, Entropy, Efficiency).
- **Fetcher**: Use the lightweight `undici`-based HTTP client. Respect custom redirect and caching logic already implemented.
- **Premium User Experience**: The CLI must have a "wow" factor. Always utilize `chalk` and emojis for a professional terminal experience. Outputs should feature clear hierarchy, horizontal separators, and color-coded metrics.

## 🛡️ 2. Safety & Security Requirements
When adding or modifying crawling mechanisms, ensure you always respect these enterprise safety suites:
- **SSRF Protection (`IPGuard`)**: Never bypass the pre-fetch DNS resolution blocking internal, private, and cloud metadata IPs.
- **Rate Limiting**: Always enforce per-host Token Bucket limits (2 req/sec) and respect `robots.txt` `crawl-delay`.
- **Scope Controls**: Strict label-based matching and Punycode support via `DomainFilter` and `SubdomainPolicy`.
- **Hardened Redirects**: Always use `RedirectController` with hop limits (Default: 2, Max: 11) and loop detection.
- **Concurrency**: Maintain strict concurrency caps (Default: 2, Hard Cap: 10) using `p-limit`.
- **Proxies**: Respect and maintain `ProxyAgent` support for routing traffic.

## 📁 3. Key Files Navigation
Familiarize yourself with these core locations:
- `plugins/core/src/crawler/crawl.ts`: Main BFS crawl orchestrator.
- `plugins/core/src/crawler/fetcher.ts`: HTTP request handling and redirect logic.
- `plugins/core/src/graph/metrics.ts`: Structural analysis algorithms.
- `plugins/cli/src/commands/sitegraph.ts`: UI/Logic for the `sitegraph` CLI command.
- `plugins/cli/src/commands/analyze.ts`: UI/Logic for the `analyze` CLI command.
- `SECURITY.md`: Safety and compliance policies.

## 🛠️ 4. Feature Implementation Workflow (Mandatory)
For all significant features or architectural changes, you **MUST** follow these steps:
1. **Plan Review**: Review the provided implementation plan or prompt.
2. **Implementation Plan**: Present a detailed technical implementation plan to the USER.
3. **Approval #1**: Stop and ask for human approval of the plan.
4. **Branching**: After approval, create a new branch from `main`.
5. **Implement & Test**: Implement the feature and ensure 100% test coverage for new logic.
6. **Approval #2**: Stop and ask for human approval of the final implementation and tests.
7. **PR Creation**: After the second approval, create a Pull Request.

## 🚀 5. Current Priority Next Steps
If the user asks what to work on, refer to these immediate goals:
1. **Sitegraph JSON**: Implement `--json` for `sitegraph` to match the `analyze` command.
2. **JS Rendering (Beta)**: Explore optional Playwright/Puppeteer integration for SPA/React SEO audits.
3. **Multi-Host Crawling**: Allow crawling cross-domain clusters (e.g., `brand-a.com` + `brand-b.com`) safely.
4. **Schema Validation**: Add automated tests for the graph output format.
5. **Interactive Graph UI**: Add filters to the HTML graph to toggle orphan/deep page visibility.

Remember: **Build deliberately. Ship aggressively. No vanity features.**
