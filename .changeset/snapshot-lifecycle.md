---
"@crawlith/core": minor
"@crawlith/cli": patch
"@crawlith/server": patch
"@crawlith/web": patch
---

Fixed crawls that never finished when a sitemap loaded after the page queue had emptied; the sitemap's pages were also never crawled.

Snapshots now always end: `completed` on success, `failed` when the crawl throws, `cancelled` on Ctrl-C/SIGTERM. Snapshots left `running` by a killed process are marked `failed` when the next crawl starts. A finished snapshot's status can no longer change, and post-crawl metrics no longer reset `limit_reached` to 0.

A crawl now ends only after every writer has finished: sitemaps still loading when the page limit is hit, and async `onPageParsed` plugin hooks.

Only finished (`completed`) snapshots are used for analysis, the dashboard's snapshot list, history, trends and the previous-crawl comparison. Failed and cancelled runs hold partial data.

Dashboard: a slow response for a previously selected snapshot, page, filter or comparison can no longer overwrite the current one, and another snapshot's data is no longer shown while the current one loads or after it fails. Failed loads now show an error instead of an empty result or an endless loading view. Issue table sorting survives refetches, and changing the search text returns to page 1. "Compare with previous" now always pairs a snapshot with the one before it (disabled on the oldest), and the comparison pickers can no longer select the same snapshot twice.

Locks: `crawlith reset` refuses to run while a crawl is still running, since it deletes the database that crawl writes to, and `LockManager.clearAllLocks` keeps locks held by live processes. A stale lock that cannot be deleted is now reported as such instead of as a race with another run.

Duplicate detection is repeatable: each run clears cluster flags left by the previous one, and `Graph.duplicateClusters` / `GraphNode.collapseInto` are now typed.

The CLI now exits with code 130 on Ctrl-C and 143 on SIGTERM instead of 0, so scripts can tell a cancelled run from a finished one. Post-crawl metric phases now go through the CLI's output controller instead of straight to stdout, which had corrupted `--format json` output, and the progress line no longer reappears once it has ended.

Failed `crawl` and `page` runs now print the reason (`Error during crawl: <message>`) instead of a bare "Error during crawl", end the progress line before printing it, and with `--format json` report errors on stderr instead of exiting silently. `metrics:complete` now carries the real duration instead of 0.

Page status reporting (numbers change between snapshots taken before and after this release):
- Non-HTML pages (PDFs, images, feeds) are recorded as fetched, so they now count toward crawled pages and crawl efficiency.
- Fetches that throw are recorded as `network_error`, so they now count as broken in the health score and broken-link totals.
- Pages that were never fetched (beyond the page limit or depth) no longer count as broken links or as critical pages.
- Status `0` is labelled by what it means: "Not crawled", "External", "Blocked by robots.txt" or "Fetch failed (<reason>)", replacing "Pending/Limit" in exports, "Network Error" in the dashboard's Technical tab and "HTTP ERR" on the page badge. The dashboard's crawl-error panel now appears when a page's fetch failed. New core exports: `describePageStatus`, `isBrokenPage`, `isFailedFetch`.

Breaking (`@crawlith/core`): `SnapshotRepository.updateSnapshotStatus` is replaced by `finishSnapshot` (only ends a `running` snapshot) and `updateSnapshotStats` (stats only). `SnapshotRepository.touchSnapshot`, `EdgeRepository.deleteEdgesForPage` and the `limitReached` option of `runPostCrawlMetrics` are removed. Snapshots gain a `pid` column.
