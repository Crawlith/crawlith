import { crawl, getDb, IPGuard } from '@crawlith/core';
import { CRAWL_CONCURRENCY_CAP, crawlSiteArgsSchema } from '../utils/schemas.js';
import { OpenCodeClient } from '../utils/types.js';

/**
 * Structured output returned from crawlSite tool.
 */
export interface CrawlSiteResult {
  snapshotId: number;
  pagesCrawled: number;
  durationMs: number;
  errorCount: number;
}

/**
 * Builds the crawlSite tool that executes a safe local Crawlith crawl.
 */
export function createCrawlSiteTool(client: OpenCodeClient) {
  return {
    description: 'Run a bounded Crawlith crawl and persist a local snapshot.',
    args: crawlSiteArgsSchema,
    async run(input: unknown): Promise<CrawlSiteResult> {
      const args = crawlSiteArgsSchema.parse(input);
      const targetUrl = new URL(args.url);

      if (!args.allowPrivateIPs) {
        const isSafe = await IPGuard.validateHost(targetUrl.hostname);
        if (!isSafe) {
          throw new Error('Target host resolves to a private/internal IP and is blocked by default');
        }
      }

      const startedAt = Date.now();
      const snapshotId = await crawl(args.url, {
        limit: args.limit,
        depth: args.depth ?? 3,
        concurrency: CRAWL_CONCURRENCY_CAP,
        maxRedirects: 5,
        debug: false
      });

      const db = getDb();
      const pageStats = db
        .prepare(
          `SELECT
            COUNT(*) AS pagesCrawled,
            SUM(CASE WHEN m.crawl_status IS NOT NULL AND m.crawl_status NOT IN ('fetched', 'cached', 'blocked_by_robots') THEN 1 ELSE 0 END) AS errorCount
           FROM metrics m
           WHERE m.snapshot_id = ?`
        )
        .get(snapshotId) as { pagesCrawled: number; errorCount: number | null };

      const result: CrawlSiteResult = {
        snapshotId,
        pagesCrawled: pageStats.pagesCrawled ?? 0,
        durationMs: Date.now() - startedAt,
        errorCount: pageStats.errorCount ?? 0
      };

      client.app.log('crawlith.opencode.crawlSite.completed', {
        snapshotId,
        pagesCrawled: result.pagesCrawled,
        durationMs: result.durationMs
      });

      return result;
    }
  };
}
