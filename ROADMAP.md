# 🚀 Crawlith Product Roadmap

> Build deliberately. Ship aggressively. No vanity features.

This roadmap outlines the evolution of Crawlith from a robust CLI engine into a comprehensive, intelligence-driven SEO and structural analysis platform.

---

## ✅ Completed Milestones
- **Core Engine**: BFS crawling, Sitemap ingestion, robots.txt compliance, and rate limiting.
- **Graph Intelligence**: PageRank-style scoring, HITS (Hubs/Authorities), and SimHash-based duplicate detection.
- **Protocols**: TLS/SSL fingerprinting, Security header audits, and DNS resolution analysis.
- **Persistence**: SQLite (WAL mode) with automated migrations and scoped plugin storage.
- **Integrations**: MCP (Model Context Protocol) server for Claude Desktop and OpenCode plugin.

---

## 🛠 Phase 1: Dashboard UI/UX Completion (Short-Term)
*Focus: Clearing technical debt in the React frontend and making the graph visualization a professional-grade analytical tool.*

- [ ] **Task 1: Complete Pending UI Components**
  - [ ] **Subtask 1.1:** Implement snapshot comparison `delta` calculations in `CriticalIssuesCard.tsx` to show metrics trending up/down between crawls.
  - [ ] **Subtask 1.2:** Build the Issue Details Drawer in `CriticalPanel.tsx` to allow deep inspection of request traces and DOM paths for specific errors.
- [ ] **Task 2: Advanced Graph Interaction**
  - [ ] **Subtask 2.1:** **Graph Filtering**: Add UI controls to filter nodes by HTTP status, depth, or specific content clusters.
  - [ ] **Subtask 2.2:** **Visual Issue Highlighting**: Automatically color-code critical nodes (e.g., orphans turn purple, broken links blink red).
  - [ ] **Subtask 2.3:** **Node Search & Isolation**: Add a search bar to the Graph explorer and "Isolate Cluster" feature to hide unrelated site sections.

## ⚡ Phase 2: Engine Scale & Rendering (Medium-Term)
*Focus: Modern web compatibility (JS evaluation) and massive scale resilience.*

- [ ] **Task 3: Modern Web Compatibility**
  - [ ] **Subtask 3.1:** **JS Rendering Engine**: Integrate Playwright/Puppeteer as an optional fetcher port for SPAs and dynamic content.
  - [ ] **Subtask 3.2:** **Memory/Resource Telemetry**: Add real-time monitoring to auto-adjust concurrency based on system load.
- [ ] **Task 4: Resiliency & Scale**
  - [ ] **Subtask 4.1:** **Resume Interrupted Crawls**: Use existing SQLite state to allow resuming a crawl that was killed or crashed.
  - [ ] **Subtask 4.2:** **Streaming Graph Construction**: Refactor graph building to stream directly to disk rather than holding massive graphs in RAM.

## 🧠 Phase 3: Analytical Intelligence (Long-Term)
*Focus: Moving from reporting data to providing actionable, predictive SEO and structural insights.*

- [ ] **Task 5: Advanced Metrics & Equity**
  - [ ] **Subtask 5.1:** **Link Equity Flow Visualization**: Visually represent how PageRank/HITS authority "flows" through site edges.
  - [ ] **Subtask 5.2:** **"What-If" Simulation**: A Sandbox mode to delete a node in the UI and see the structural impact on PageRank before making live site changes.
- [ ] **Task 6: AI-Driven Insights**
  - [ ] **Subtask 6.1:** **Internal Link Recommendations**: Suggest "Page A should link to Page B" based on SimHash similarity.
  - [ ] **Subtask 6.2:** **AI Executive Summaries**: Use the MCP server to generate plain-English summaries of site health from crawl JSON.

## 📁 Phase 4: Integrations & DevOps
- [ ] **Task 7: Export & Schema**
  - [ ] **Subtask 7.1:** **Standardized Graph Exports**: Support `.gexf` or `GraphML` for ingestion into tools like Gephi.
  - [ ] **Subtask 7.2:** **JSON Schema Versioning**: Enforce strict schemas for `graph.json` to prevent breaking downstream CI/CD.
- [ ] **Task 8: Observability**
  - [ ] **Subtask 8.1:** **Crawl Trace Logging**: Emit `.log` files mapping the exact chronological path the bot took.
  - [ ] **Subtask 8.2:** **Crawl Playback**: Visualize the discovery order in the UI to diagnose crawl traps.
