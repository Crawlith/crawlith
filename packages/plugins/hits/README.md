# HITS Plugin (Hubs & Authorities)

Crawlith plugin that computes Hub and Authority scores using the HITS algorithm to identify relative importance and structural roles of pages in a crawl graph.

## Architecture

This plugin follows the **ScoreProvider** architecture:
- **Service**: `HITSService` contains the iterative algorithm logic.
- **Storage**: Maps results to a plugin-scoped SQLite table.
- **Aggregation**: Participates in snapshot-level score aggregation (mapping authority scores).

## Score Logic

HITS identifies two types of important pages:
1. **Authorities**: Pages that are linked to by many high-quality hubs. They contain valuable information.
2. **Hubs**: Pages that link to many high-quality authorities. They serve as catalogs or directories.

The plugin also classifies nodes into roles:
- **Power**: High Authority AND High Hub score.
- **Authority**: High Authority score only.
- **Hub**: High Hub score only.
- **Balanced**: Moderate scores in both.
- **Peripheral**: Low scores or isolated.

## Usage

Enable during a crawl by passing the flag:
```bash
crawlith crawl https://example.com --compute-hits
```

## Output

Results are included in the JSON report under `plugins.hits` and stored locally in the plugin database.

```json
{
  "plugins": {
    "hits": {
      "authorityCount": 42,
      "hubCount": 15,
      "topAuthorities": [...],
      "topHubs": [...]
    }
  }
}
```
