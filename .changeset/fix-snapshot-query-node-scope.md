---
"@crawlith/core": patch
---

Scope snapshot page loading to URLs seen in the selected snapshot so rerunning crawls with different URL normalization policies, such as `--no-query`, does not retain stale query-URL nodes in graph exports. Fixes #103.
