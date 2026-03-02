# @crawlith/opencode-plugin

Production-ready OpenCode plugin that exposes Crawlith crawl intelligence as deterministic, structured tools.

## Installation

### npm installation

```bash
npm install @crawlith/opencode-plugin
```

```json
{
  "plugins": [
    {
      "package": "@crawlith/opencode-plugin"
    }
  ]
}
```

### Local directory installation

```json
{
  "plugins": [
    {
      "path": "./packages/opencode-plugin"
    }
  ]
}
```

## OpenCode config example

```json
{
  "plugins": [
    {
      "package": "@crawlith/opencode-plugin",
      "name": "crawlith"
    }
  ]
}
```

## Tools

### `crawlSite`
Runs a local Crawlith crawl with safe defaults:
- schema validation with Zod
- private IP blocking by default
- bounded crawl limit and concurrency caps

### `analyzeSnapshot`
Returns site-quality metrics from one snapshot:
- health score
- signal coverage percentages
- orphan + duplicate metrics
- PageRank summary

### `diffSnapshots`
Compares two snapshots and returns deterministic regression data:
- new and removed pages
- new orphan pages
- lost internal links
- schema regressions
- authority shift summary

### `getHighAuthorityGaps`
Finds high-authority pages missing:
- schema markup
- OpenGraph metadata
- HTML language declaration

## Example tool invocation JSON

```json
{
  "tool": "crawlSite",
  "args": {
    "url": "https://example.com",
    "limit": 500,
    "depth": 3,
    "allowPrivateIPs": false
  }
}
```

## Security model

- All tool input is validated with strict Zod schemas.
- URL protocol is restricted to `http` and `https`.
- `crawlSite` blocks localhost/private IP targets unless explicitly overridden.
- Tool implementation does not execute arbitrary shell commands.

## Performance notes

- Snapshot and graph reads are bulk-loaded once per operation.
- Responses are truncated to context-safe list sizes.
- SQL queries use snapshot/site joins aligned with existing schema indexes.
- Crawl defaults enforce bounded work with hard caps.

## Build

```bash
pnpm --filter @crawlith/opencode-plugin build
```
