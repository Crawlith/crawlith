import { test, expect } from 'vitest';
import { describePageStatus, isBrokenPage } from '../src/graph/nodeStatus.js';

test.each([
  [{ status: 200 }, '200', false],
  [{ status: 404 }, '404', true],
  [{ status: 0 }, 'Not crawled', false],
  [{ status: 0, isInternal: false }, 'External', false],
  [{ status: 0, crawlStatus: 'blocked_by_robots' }, 'Blocked by robots.txt', false],
  [{ status: 0, crawlStatus: 'network_error' }, 'Fetch failed (network error)', true],
  [{ status: 0, crawlStatus: 'redirect_loop', securityError: 'redirect_loop' }, 'Fetch failed (redirect loop)', true],
  [{ status: 0, crawlStatus: 'fetched' }, 'Not crawled', false]
])('%o is labelled %s (broken: %s)', (page, label, broken) => {
  expect(describePageStatus(page)).toBe(label);
  expect(isBrokenPage(page)).toBe(broken);
});
