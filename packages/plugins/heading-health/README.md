# `@crawlith/plugin-heading-health`

Analyzes the heading structure, hierarchy health, and content distribution of every page in a crawl or single-page analysis.

---

## What It Does

The heading-health plugin parses the raw HTML of each crawled page, extracts all `<h1>` through `<h6>` tags, and runs a suite of structural checks. It scores each page from **0–100**, assigns a status (`Healthy`, `Moderate`, `Poor`), and surfaces actionable issues. A snapshot-level summary is also produced, giving you a site-wide view of heading quality.

---

## How It Works

The plugin runs across three lifecycle hooks:

### `onInit`
Registers the plugin's database schema columns (`score`, `status`, `analysis_json`) so per-URL results can be persisted across runs.

### `onMetrics`
Triggered after crawling, once the full page graph is available. For each page node in the graph:

1. **Extracts headings** from raw HTML using regex-based parsing, preserving heading level and text.
2. **Builds a tree** tracking parent–child relationships between headings.
3. **Segments content** between headings to measure word count and keyword concentration per section.
4. **Computes structural metrics** (see below).
5. **Detects site-wide duplicates** by comparing H1 norms, H2 set hashes, and structural pattern hashes across all pages (cross-page duplicate risk for sections).
6. **Scores and statuses** each page, attaches the payload to the graph node, and persists data to the database.
7. Emits a **snapshot-level summary** to the context.

### `onReport`
Attaches the snapshot-level `HeadingHealthSummary` to the final result object under `result.plugins.headingHealth`.

---

## CLI Usage

Add `--heading` to the `crawl` or `page` commands to activate the plugin:

```bash
# Single page
crawlith page https://example.com --heading

# Full crawl
crawlith crawl https://example.com --heading

# Force a fresh recompute (bypass 24h cache)
crawlith crawl https://example.com --heading --heading-force-refresh
```

---

## Metrics Explained

Each page receives a `HeadingHealthPayload` with the following fields:

| Field | Description |
| :--- | :--- |
| `score` | Overall heading health score, 0–100 |
| `status` | `Healthy` (≥70), `Moderate` (≥40), or `Poor` (<40) |
| `issues` | List of human-readable issue strings detected |
| `map` | Ordered array of all heading nodes with level, text, index, and parent index |
| `missing_h1` | `1` if no H1 exists on the page, else `0` |
| `multiple_h1` | `1` if more than one H1 exists, else `0` |
| `entropy` | Shannon entropy of heading level distribution — higher = more chaotic structure |
| `max_depth` | Deepest heading level used (e.g., `4` means H4 is the deepest) |
| `avg_depth` | Average heading level across all headings |
| `heading_density` | Ratio of heading count to total word count |
| `fragmentation` | Proportion of headings that are H1 or H2 — high fragmentation = too many top-level headings |
| `volatility` | Average level-jump between consecutive headings — high = erratic structure |
| `hierarchy_skips` | Number of times heading level jumps by more than 1 (e.g., H2 → H4) |
| `reverse_jumps` | Number of times heading level drops by more than 1 (e.g., H4 → H2) |
| `thin_sections` | Number of content sections containing fewer than 80 words |
| `duplicate_h1_group` | Number of other pages sharing the same normalized H1 text |
| `similar_h1_group` | Number of pages with a Jaccard similarity > threshold to this page's H1 |
| `identical_h2_set_group` | Number of pages sharing the exact same ordered set of H2 text |
| `duplicate_pattern_group` | Number of pages with the same heading level pattern (e.g., `1>2>2>3`) |
| `template_risk` | Combined risk score indicating the page may use a templated heading structure |

---

## Site-Wide Summary (`HeadingHealthSummary`)

Attached to `result.plugins.headingHealth` after a crawl:

| Field | Description |
| :--- | :--- |
| `avgScore` | Mean heading health score across all evaluated pages |
| `evaluatedPages` | Number of pages that had headings and were scored |
| `totalMissing` | Total pages missing an H1 |
| `totalMultiple` | Total pages with multiple H1 tags |
| `totalSkips` | Sum of hierarchy skips across all pages |
| `totalReverseJumps` | Sum of reverse hierarchy jumps across all pages |
| `totalThinSections` | Total count of thin content sections across the site |
| `avgEntropy` | Mean structural entropy — a site-wide indicator of heading consistency |
| `poorPages` | Number of pages rated `Poor` |

---

## Detected Issues

The plugin surfaces plain-language issues on each page:

- `Missing H1` — No H1 tag found
- `Multiple H1 found` — More than one H1 on the page
- `Empty or near-empty H1` — H1 text is fewer than 6 characters
- `H1 diverges from <title>` — H1 and page title have low Jaccard similarity (< 0.3)
- `N hierarchy skips detected` — Heading level jumps more than 1 step forward
- `N reverse hierarchy jumps detected` — Heading level drops more than 1 step
- `Thin section under "..."` — A content section has fewer than 80 words
- `High structural entropy` — Entropy score exceeds 2.1
- `Section fragmentation is high` — More than 65% of headings are H1/H2

---

## Data Storage

Per-URL results are persisted in the plugin's scoped database table. The stored columns are:

- `score` — Integer health score
- `status` — `Healthy`, `Moderate`, or `Poor`
- `analysis_json` — Full `HeadingHealthPayload` serialized as JSON

This data is available for future queries via `ctx.db.data.find()` in other plugins or custom tooling.
