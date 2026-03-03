import type { CrawlithPlugin, PluginContext } from '@crawlith/core';
import { Command, getDb, getDecryptedConfigKey, setEncryptedConfigKey } from '@crawlith/core';

const PAGESPEED_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CACHE_WINDOW_HOURS = 24;
const STRATEGY = 'mobile';
let configCommandRegistered = false;

interface PageSpeedSummary {
  strategy: 'mobile';
  score: number;
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  coreWebVitals: 'PASS' | 'FAIL';
  hasFieldData: boolean;
  source: 'cache' | 'api';
}

/**
 * Emit plugin-owned, compact PageSpeed output via CLI logger.
 */
function emitPageSpeedOutput(ctx: PluginContext, payload: { summary?: PageSpeedSummary; error?: string }): void {
  if (payload.error) {
    ctx.logger?.error(`\nPageSpeed Report (Mobile)\n\nError: ${payload.error}`);
    return;
  }

  const summary = payload.summary;
  if (!summary) return;
  const scoreTone = summary.score >= 90 ? 'good' : (summary.score >= 50 ? 'warn' : 'bad');
  const sourceText = summary.source === 'cache' ? 'cache (24h)' : 'api';

  ctx.logger?.info(`\nPageSpeed Report (Mobile)\n`);
  ctx.logger?.info(`Performance Score: ${summary.score}/100 (${scoreTone}, source: ${sourceText})`);
  ctx.logger?.info(`LCP: ${summary.lcp !== null ? `${summary.lcp}s` : 'N/A'}`);
  ctx.logger?.info(`CLS: ${summary.cls !== null ? summary.cls : 'N/A'}`);
  ctx.logger?.info(`TBT: ${summary.tbt !== null ? `${summary.tbt}ms` : 'N/A'}`);
  ctx.logger?.info(`Core Web Vitals: ${summary.coreWebVitals}`);
  ctx.logger?.info(`Field Data: ${summary.hasFieldData ? 'Available' : 'Not available (low traffic URL)'}`);
}

/**
 * Ensure the PageSpeed plugin table exists.
 */
function ensurePageSpeedTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_pagespeed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      strategy TEXT CHECK(strategy IN ('mobile', 'desktop')) NOT NULL,
      performance_score INTEGER,
      lcp REAL,
      cls REAL,
      tbt REAL,
      raw_json TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_plugin_pagespeed_snapshot_url ON plugin_pagespeed(snapshot_id, url);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_plugin_pagespeed_fetched_at ON plugin_pagespeed(fetched_at);');
}

/**
 * Pull numeric metric values from the Lighthouse payload.
 */
function summarizePageSpeedResponse(response: any, source: 'cache' | 'api'): PageSpeedSummary {
  const categories = response?.lighthouseResult?.categories || {};
  const audits = response?.lighthouseResult?.audits || {};
  const fieldData = response?.loadingExperience?.overall_category;

  const score = Math.round((categories.performance?.score ?? 0) * 100);
  const lcp = typeof audits['largest-contentful-paint']?.numericValue === 'number'
    ? Number((audits['largest-contentful-paint'].numericValue / 1000).toFixed(2))
    : null;
  const cls = typeof audits['cumulative-layout-shift']?.numericValue === 'number'
    ? Number(audits['cumulative-layout-shift'].numericValue.toFixed(3))
    : null;
  const tbt = typeof audits['total-blocking-time']?.numericValue === 'number'
    ? Number(Math.round(audits['total-blocking-time'].numericValue))
    : null;

  return {
    strategy: STRATEGY,
    score,
    lcp,
    cls,
    tbt,
    coreWebVitals: fieldData === 'FAST' ? 'PASS' : 'FAIL',
    hasFieldData: fieldData !== undefined,
    source
  };
}

/**
 * Query cache for a valid PageSpeed row in the previous 24 hours.
 */
function getRecentCache(snapshotId: number, url: string): any | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT raw_json
    FROM plugin_pagespeed
    WHERE snapshot_id = ?
      AND url = ?
      AND strategy = ?
      AND datetime(fetched_at) >= datetime('now', '-${CACHE_WINDOW_HOURS} hours')
    ORDER BY datetime(fetched_at) DESC
    LIMIT 1
  `).get(snapshotId, url, STRATEGY) as { raw_json: string } | undefined;

  return row ? JSON.parse(row.raw_json) : null;
}

/**
 * Execute a fetch with timeout and retry/backoff behavior.
 */
async function fetchWithRetry(url: string): Promise<Response> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      return response;
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      const delayMs = 500 * (2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Unexpected retry state for PageSpeed request.');
}

/**
 * Persist a full API payload for future reports.
 */
function storeResponse(snapshotId: number, url: string, summary: PageSpeedSummary, rawJson: any): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO plugin_pagespeed (
      snapshot_id,
      url,
      strategy,
      performance_score,
      lcp,
      cls,
      tbt,
      raw_json,
      fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(snapshotId, url, summary.strategy, summary.score, summary.lcp, summary.cls, summary.tbt, JSON.stringify(rawJson));
}

/**
 * Confirm that page URL belongs to the current snapshot.
 */
function validateUrlInSnapshot(snapshotId: number, url: string): void {
  const db = getDb();
  const row = db.prepare(`
    SELECT 1
    FROM pages
    WHERE normalized_url = ?
      AND last_seen_snapshot_id = ?
    LIMIT 1
  `).get(url, snapshotId) as { 1: number } | undefined;

  if (!row) {
    throw new Error(`PageSpeed plugin requires ${url} to exist in snapshot ${snapshotId}.`);
  }
}

/**
 * Register the top-level config command once.
 */
function registerConfigCommand(cli: Command): void {
  if (configCommandRegistered) return;
  if (cli.name() !== 'crawlith') return;

  const configCmd = new Command('config').description('Manage Crawlith plugin configuration');
  const pageSpeedCmd = new Command('pagespeed').description('Manage PageSpeed API key');

  pageSpeedCmd
    .command('set <api_key>')
    .description('Set and encrypt Google PageSpeed Insights API key')
    .action((apiKey: string) => {
      setEncryptedConfigKey('pagespeed', apiKey);
      console.log('✅ PageSpeed API key saved to ~/.crawlith/config.json (encrypted).');
    });

  configCmd.addCommand(pageSpeedCmd);
  cli.addCommand(configCmd);
  configCommandRegistered = true;
}

/**
 * PageSpeed plugin.
 */
export const PageSpeedPlugin: CrawlithPlugin = {
  name: 'pagespeed',
  register: (cli: Command) => {
    registerConfigCommand(cli);

    if (cli.name() === 'page') {
      cli.option('--pagespeed', 'Attach Google PageSpeed Insights report (mobile strategy)');
      cli.option('--force', 'Force a fresh PageSpeed API request and bypass 24h cache');
    }
  },
  hooks: {
    onReport: async (ctx: PluginContext, result: any) => {
      const flags = ctx.flags || {};
      if (ctx.command !== 'page' || !flags.pagespeed) return;

      result.plugins = result.plugins || {};

      try {
        const pageUrl = result?.pages?.[0]?.url;
        if (!pageUrl || !URL.canParse(pageUrl)) {
          throw new Error('PageSpeed requires an absolute URL from page analysis output.');
        }

        const snapshotId = result?.snapshotId;
        if (!snapshotId) {
          throw new Error('PageSpeed plugin requires a snapshot-backed result.');
        }

        ensurePageSpeedTable();
        validateUrlInSnapshot(snapshotId, pageUrl);

        const apiKey = getDecryptedConfigKey('pagespeed');

        let raw = !flags.force ? getRecentCache(snapshotId, pageUrl) : null;
        let summary: PageSpeedSummary;

        if (raw) {
          summary = summarizePageSpeedResponse(raw, 'cache');
        } else {
          const params = new URLSearchParams({
            url: pageUrl,
            category: 'performance',
            strategy: STRATEGY,
            key: apiKey
          });

          const response = await fetchWithRetry(`${PAGESPEED_ENDPOINT}?${params.toString()}`);
          raw = await response.json();

          if (!response.ok) {
            const message = raw?.error?.message || `PageSpeed request failed with status ${response.status}`;
            throw new Error(message);
          }

          summary = summarizePageSpeedResponse(raw, 'api');
          storeResponse(snapshotId, pageUrl, summary, raw);
        }

        result.plugins.pagespeed = {
          summary,
          raw
        };
        emitPageSpeedOutput(ctx, { summary });
      } catch (error) {
        const message = (error as Error).message;
        result.plugins.pagespeed = { error: message };
        emitPageSpeedOutput(ctx, { error: message });
        ctx.logger?.error(`[plugin:pagespeed] ${message}`);
      }
    }
  }
};

export default PageSpeedPlugin;
