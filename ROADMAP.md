# 🚀 Crawlith Feature Roadmap

> Build deliberately. Ship aggressively. No vanity features.

---

# 🌍 Crawl Intelligence

- [x] Sitemap.xml ingestion (seed URLs before BFS)
- [x] Incremental crawl mode (recrawl only changed pages)
- [x] Diff mode (`--compare old.json new.json`)
- [x] Canonical tag detection
- [X] noindex / nofollow detection
- [x] Broken internal link detection (non-200 tracking)
- [x] Redirect chain detection (Hardened loops/hops)
- [x] Duplicate content detection (SHA-256 + SimHash)
- [x] Soft 404 detection
- [x] Crawl trap detection (infinite params, calendars, etc.)

---

# 🛠 Infrastructure & Protocol Audit

- [x] TLS / SSL fingerprinting (Version, Ciphers)
- [x] Certificate validation & expiry monitoring
- [x] Security header health (HSTS, CSP, etc.)
- [x] DNS resolution analysis (Redundancy, IPv6)
- [x] Performance timing (TTFB, Handshake latency)

---

# 📊 Advanced Metrics

- [x] PageRank-style scoring
- [x] Internal link depth distribution
- [ ] Link equity flow visualization
- [x] Click distance analysis
- [x] Content cluster detection
- [ ] Hub/authority identification
- [ ] Page importance percentile ranking
- [x] Orphan severity scoring

---

# 🔎 SEO & Content Analysis

- [x] Title length validation
- [x] Meta description checks
- [x] Missing H1 detection
- [x] Word count extraction
- [x] Thin content detection
- [x] Image alt tag analysis
- [x] External link ratio
- [x] Structured data detection (JSON-LD)

---

# 🔐 Crawl Controls & Safety

- [x] Rate limiting (Token Bucket/Leaky Bucket)
- [x] Domain whitelist / blacklist
- [x] Subdomain toggle (--include-subdomains)
- [x] Custom user-agent (Dynamic crawlith/${version})
- [x] Proxy support (undici.ProxyAgent)
- [x] Retry strategy (Exponential backoff)
- [x] Respect crawl-delay (robots.txt integrated)
- [x] Max response size limit
- [x] SSRF internal IP blocking (IPGuard resolution)

---

# 📁 Output & Reporting

- [x] CSV export
- [x] Markdown report generation
- [x] Interactive dashboard mode (D3.js integration)
- [x] Static site report bundle (crawlith-reports/)
- [ ] Graph filtering in UI
- [ ] Visual issue highlighting
- [ ] Export graph as GEXF / GraphML
- [ ] JSON schema versioning + validation
- [ ] JSON output for `sitegraph` command

---

# 🧠 Visualization (D3 Enhancements)

- [ ] Clustered graph layout
- [ ] Depth-based color coding
- [ ] Authority-based node sizing
- [ ] Toggle edge direction
- [ ] Isolate subgraph feature
- [ ] Node search in UI
- [ ] Performance mode (10k+ nodes)
- [ ] Collapse/expand sections

---

# ⚡ Performance & Scale

- [ ] Persistent crawl storage (SQLite)
- [ ] Resume interrupted crawl
- [ ] Distributed crawl mode
- [ ] Streaming graph construction
- [ ] Memory usage telemetry
- [ ] Adaptive concurrency
- [ ] Parallel domain partitioning

---

# 🧪 Developer Experience

- [x] Verbose debug mode (--debug flag)
- [ ] Crawl trace logging
- [ ] Visualization of crawl order
- [x] Deterministic crawl mode (BFS + Mock site testing)
- [ ] Benchmark command
- [x] Dynamic versioning from package.json
- [ ] Mock site generator for testing
- [x] Global CLI binary support
- [x] Contribution & development guidelines
- [x] GitHub Actions NPM Publish Workflow

---

# 🤯 Ambitious / Product-Level Features

- [ ] AI-powered issue summaries
- [ ] JS Rendering (Playwright integration)
- [ ] Multi-host cluster crawling (safe domain-hopping)
- [ ] Internal link optimization suggestions
- [ ] Auto internal link recommendations
- [ ] Competitor crawl comparison
- [ ] Crawl cost estimation
- [ ] “What-if” page removal simulation
- [ ] Time-series crawl history

---
