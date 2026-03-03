# Crawlith Plugin Strategy: Core vs Plugin Architecture

This document outlines the architectural recommendations for each Crawlith plugin. The goal is to move foundational "intelligence" features into the core engine while maintaining a lightweight plugin system for external integrations and delivery formats.

## Architectural Principles

1.  **Core**: Foundational intelligence, graph algorithms, crawler safety, and primary SEO signals.
2.  **Plugin**: External APIs, niche formats, large/heavy dependencies, and delivery/notification layers.

---

## Detailed Review & Recommendations

| Plugin | Recommendation | Rationale |
| :--- | :--- | :--- |
| **Content Clustering** | **Core** | Content similarity (SimHash) is a primary audit signal. Essential for finding thin content/internal competition. |
| **Duplicate Detection** | **Core** | Fundamental for graph hygiene. Handling exact/near duplicates and collapsing nodes should be native. |
| **Health Score Engine** | **Core** | This is the "brain" that aggregates all signals. A unified health score should be a core result. |
| **HITS** | **Core** | Standard graph algorithm for Hubs and Authorities; foundational to link intelligence. |
| **PageRank** | **Core** | Standard graph algorithm for centrality; foundational to link intelligence. |
| **Orphan Intelligence** | **Core** | Finding pages with zero in-links is a primary use case for crawling. |
| **Crawl Policy** | **Core** | Defining path rules and crawler constraints is better handled natively by the engine. |
| **Crawl Trap Analyzer** | **Core** | A critical safety mechanism to prevent infinite loops (e.g., dynamic calendar pages). |
| **Heading Health** | **Core** | A simple but essential structural audit that every SEO tool should have by default. |
| **Soft 404 Detector** | **Core** | Enhances crawling accuracy by identifying fake 200 OK responses. |
| **Snapshot Diff** | **Core** | Foundational for monitoring site changes over time (Monitoring/Alerting). |
| **SimHash** | **Core** | Redundant as a plugin; core utility already used by clustering and duplicate detection. |
| **Exporter** | **Plugin** | Diverse targets (CSV, S3, SQL, BigQuery) are perfect for an extensible plugin ecosystem. |
| **Reporter** | **Plugin** | Presentation logic (HTML Reports, PDF) varies widely per user; keeps core headless. |
| **PageSpeed** | **Plugin** | Heavy external dependency (PageSpeed Insights API); better as an optional module. |
| **Signals** | **Plugin** | Integrates with external platforms (GSC, Ahrefs, Moz); high maintenance/variance. |

---

## Implementation Plan

### Phase 1: Core Consolidation
- [x] Move `hits` and `pagerank` logic into `@crawlith/core/graph`.
- [x] Integrate `crawl-trap-analyzer` and `crawl-policy` into the `@crawlith/core/crawler`.
- [x] Incorporate `health-score-engine` into `@crawlith/core/scoring`.

### Phase 2: Feature Integration
- [x] Refactor `content-clustering` and `duplicate-detection` into a dedicated `@crawlith/core/analysis` module.
- [x] Add `snapshot-diff` as a native capability in `@crawlith/core/diff`.
- [x] Add `heading-health`, `soft404-detector`, `orphan-intelligence` into core.

### Phase 3: Plugin Ecosystem Cleanup
- [x] Retain `exporter`, `reporter`, `pagespeed`, and `signals` as standalone packages in `packages/plugins/`.
- [x] Update plugin loader in `core` to reflect the refined scope.
- [x] Remove migrated packages from `packages/plugins/`.
