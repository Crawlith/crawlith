import type { GraphNode } from './graph.js';

/** The fields that decide what an HTTP status of 0 means for a page. */
export type PageStatusFields = Pick<GraphNode, 'status'> & Partial<Pick<GraphNode, 'crawlStatus' | 'securityError' | 'isInternal'>>;

// crawl_status values that do not mean the fetch failed: the page was fetched, reused, or deliberately not fetched.
const NOT_FAILED: Record<string, true> = { fetched: true, cached: true, blocked_by_robots: true, skipped: true };

/**
 * True when a fetch was attempted and failed: an HTTP error status, or no response at all (network error,
 * retries exhausted, redirect loop, oversized body, blocked by a security guard). Pages never fetched are not broken.
 */
export function isBrokenPage(page: PageStatusFields): boolean {
  if (page.status >= 400) return true;
  if (page.status !== 0) return false;
  return Boolean(page.securityError) || (page.crawlStatus !== undefined && page.crawlStatus !== '' && !NOT_FAILED[page.crawlStatus]);
}

/** True when a fetch was attempted and returned no HTTP response. */
export function isFailedFetch(page: PageStatusFields): boolean {
  return page.status === 0 && isBrokenPage(page);
}

/** Readable status for reports: the HTTP code when there is one, otherwise why there isn't one. */
export function describePageStatus(page: PageStatusFields): string {
  if (page.status > 0) return String(page.status);
  if (page.crawlStatus === 'blocked_by_robots') return 'Blocked by robots.txt';
  if (isFailedFetch(page)) {
    const reason = page.securityError || page.crawlStatus;
    return reason ? `Fetch failed (${reason.replace(/_/g, ' ')})` : 'Fetch failed';
  }
  if (page.isInternal === false) return 'External';
  return 'Not crawled';
}
