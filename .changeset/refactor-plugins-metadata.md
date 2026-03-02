---
"@crawlith/plugin-content-clustering": patch
"@crawlith/plugin-crawl-policy": patch
"@crawlith/plugin-crawl-trap-analyzer": patch
"@crawlith/plugin-duplicate-detection": patch
"@crawlith/plugin-exporter": patch
"@crawlith/plugin-heading-health": patch
"@crawlith/plugin-health-score-engine": patch
"@crawlith/plugin-hits": patch
"@crawlith/plugin-orphan-intelligence": patch
"@crawlith/plugin-pagerank": patch
"@crawlith/plugin-reporter": patch
"@crawlith/plugin-signals": patch
"@crawlith/plugin-simhash": patch
"@crawlith/plugin-snapshot-diff": patch
"@crawlith/plugin-soft404-detector": patch
---

Refactor internal plugins to utilize centralized metadata loading and idempotent registration logic.
Fixed structured signals plugin and ensured its visibility in both 'crawl' and 'page' commands.
Fixed Commander 12 compatibility issues in the CLI.
