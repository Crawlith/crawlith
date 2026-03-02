import { createRequire } from 'node:module';
import { Command, CrawlithPlugin, PluginContext, getDb } from '@crawlith/core';
import { clusterBySchemaHash, detectOgMismatches, parseSignalsFromHtml } from './src/signals.js';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

type BufferedSignal = ReturnType<typeof parseSignalsFromHtml>;

function getSnapshotIdForMetrics(ctx: PluginContext): number | null {
  if (typeof ctx.snapshotId === 'number') return ctx.snapshotId;
  const db = getDb();
  const row = db.prepare(`SELECT id FROM snapshots WHERE status = 'running' ORDER BY id DESC LIMIT 1`).get() as { id: number } | undefined;
  return row?.id ?? null;
}

function initSignalsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      snapshot_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      has_og INTEGER DEFAULT 0,
      og_hash TEXT,
      og_title TEXT,
      og_image TEXT,
      og_url TEXT,
      page_title TEXT,
      canonical_url TEXT,
      has_lang INTEGER DEFAULT 0,
      lang TEXT,
      lang_base TEXT,
      has_hreflang INTEGER DEFAULT 0,
      hreflang_count INTEGER DEFAULT 0,
      has_jsonld INTEGER DEFAULT 0,
      jsonld_count INTEGER DEFAULT 0,
      schema_types TEXT,
      primary_schema_type TEXT,
      schema_hash TEXT,
      broken_jsonld INTEGER DEFAULT 0,
      PRIMARY KEY (snapshot_id, url)
    );
    CREATE INDEX IF NOT EXISTS idx_signals_snapshot_id ON signals(snapshot_id);
    CREATE INDEX IF NOT EXISTS idx_signals_url ON signals(url);
    CREATE INDEX IF NOT EXISTS idx_signals_primary_schema_type ON signals(primary_schema_type);
    CREATE INDEX IF NOT EXISTS idx_signals_lang ON signals(lang);
    CREATE INDEX IF NOT EXISTS idx_signals_has_jsonld ON signals(has_jsonld);
  `);
}

function computeSignalsReport(snapshotId: number) {
  const db = getDb();
  const signals = db.prepare('SELECT * FROM signals WHERE snapshot_id = ?').all(snapshotId) as any[];
  if (signals.length === 0) return null;

  const metrics = db.prepare(`
    SELECT p.normalized_url AS url, m.pagerank_score, m.authority_score, p.depth
    FROM metrics m
    JOIN pages p ON p.id = m.page_id
    WHERE m.snapshot_id = ?
  `).all(snapshotId) as Array<{ url: string; pagerank_score: number | null; authority_score: number | null; depth: number | null }>;

  const urlMetrics = new Map(metrics.map((row) => [row.url, row]));
  const total = signals.length;
  const coverage = {
    og: Number(((signals.filter((s) => s.has_og).length / total) * 100).toFixed(2)),
    lang: Number(((signals.filter((s) => s.has_lang).length / total) * 100).toFixed(2)),
    hreflang: Number(((signals.filter((s) => s.has_hreflang).length / total) * 100).toFixed(2)),
    jsonld: Number(((signals.filter((s) => s.has_jsonld).length / total) * 100).toFixed(2))
  };

  const brokenJsonLdCount = signals.filter((s) => s.broken_jsonld).length;
  const schemaDistribution = new Map<string, number>();
  for (const row of signals) {
    const types = JSON.parse(row.schema_types || '[]') as string[];
    for (const t of types) schemaDistribution.set(t, (schemaDistribution.get(t) || 0) + 1);
  }

  const ranked = signals.map((s) => ({
    ...s,
    pagerank: urlMetrics.get(s.url)?.pagerank_score ?? 0,
    authority: urlMetrics.get(s.url)?.authority_score ?? 0,
    impact: ((urlMetrics.get(s.url)?.pagerank_score ?? 0) * 0.6) + ((urlMetrics.get(s.url)?.authority_score ?? 0) * 0.4)
  }));

  const highMissingJsonLd = ranked.filter((r) => !r.has_jsonld).sort((a, b) => b.impact - a.impact).slice(0, 20);
  const highMissingOg = ranked.filter((r) => !r.has_og).sort((a, b) => b.authority - a.authority).slice(0, 20);
  const highMissingLang = ranked.filter((r) => !r.has_lang).sort((a, b) => b.impact - a.impact).slice(0, 20);

  const ogClusters = new Map<string, number>();
  for (const row of signals) if (row.og_hash) ogClusters.set(row.og_hash, (ogClusters.get(row.og_hash) || 0) + 1);
  const duplicateOgClusters = Array.from(ogClusters.entries()).filter(([, size]) => size > 1).map(([hash, size]) => ({ hash, size })).sort((a, b) => b.size - a.size).slice(0, 10);

  const ogTitleFreq = new Map<string, number>();
  for (const row of signals) if (row.og_title) ogTitleFreq.set(row.og_title.toLowerCase(), (ogTitleFreq.get(row.og_title.toLowerCase()) || 0) + 1);
  const ogEntropy = Number((1 - (Math.max(...Array.from(ogTitleFreq.values()), 0) / Math.max(1, signals.filter((s) => s.og_title).length))).toFixed(3));

  const ogMismatches = detectOgMismatches(signals);
  const schemaClusters = clusterBySchemaHash(signals);

  const hreflangMap = db.prepare(`
    SELECT p.normalized_url AS url, p.canonical_url, s.has_hreflang
    FROM pages p
    LEFT JOIN signals s ON s.snapshot_id = ? AND s.url = p.normalized_url
    WHERE p.last_seen_snapshot_id = ?
  `).all(snapshotId, snapshotId) as Array<{ url: string; canonical_url: string | null; has_hreflang: number | null }>;

  const hreflangCanonicalMismatch = hreflangMap.filter((row) => row.has_hreflang && !row.canonical_url).length;

  const schemaTypesTop = Array.from(schemaDistribution.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([type, count]) => ({ type, count }));
  const schemaDiversity = schemaDistribution.size > 0 ? Math.min(1, schemaDistribution.size / 12) : 0;
  const hreflangIntegrity = Math.max(0, 100 - (hreflangCanonicalMismatch / Math.max(1, total) * 100));
  const authorityGapPenalty = Math.min(100, highMissingJsonLd.reduce((sum, r) => sum + (r.impact * 2), 0));

  const score = Math.max(0, Math.min(100,
    (coverage.jsonld * 0.3)
    + ((100 - authorityGapPenalty) * 0.2)
    + (coverage.og * 0.15)
    + (coverage.lang * 0.1)
    + (hreflangIntegrity * 0.1)
    + ((schemaDiversity * 100) * 0.15)
  ));

  return {
    snapshotId,
    signalsScore: Number(score.toFixed(2)),
    coverage,
    brokenJsonLdCount,
    schemaTypesTop,
    duplicateOgClusters,
    ogEntropy,
    ogMismatches,
    schemaClusterCount: Array.from(schemaClusters.values()).filter((cluster) => cluster.length > 1).length,
    highImpactFixes: [
      ...highMissingJsonLd.slice(0, 5).map((r) => ({ impact: 'high', type: 'missing_jsonld', url: r.url })),
      ...highMissingOg.slice(0, 5).map((r) => ({ impact: 'high', type: 'missing_og', url: r.url }))
    ],
    mediumImpactFixes: highMissingLang.slice(0, 10).map((r) => ({ impact: 'medium', type: 'missing_lang', url: r.url })),
    lowImpactFixes: ogMismatches.slice(0, 10).map((r) => ({ impact: 'low', type: r.reason, url: r.url })),
    highAuthorityMissingSchema: highMissingJsonLd.map((r) => ({ url: r.url, impact: Number(r.impact.toFixed(3)) }))
  };
}

/**
 * Structured Signals plugin.
 */
const SignalsPlugin: CrawlithPlugin = {
  name: 'signals',
  version: pkg.version,
  description: pkg.description,
  register: (cli: Command) => {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
      cli.option('--signals', 'Enable structured signals intelligence analysis');
    }
  },
  hooks: {
    onInit: async () => {
      initSignalsTable();
    },
    onPageParsed: async (ctx: PluginContext, page: any) => {
      if (!ctx.flags?.signals) return;
      const buffer: BufferedSignal[] = (ctx.metadata?.signalsBuffer as BufferedSignal[] | undefined) ?? [];
      const contentLanguage = page.headers?.['content-language'];
      buffer.push(parseSignalsFromHtml(page.html || '', page.url, Array.isArray(contentLanguage) ? contentLanguage[0] : contentLanguage));
      ctx.metadata = ctx.metadata || {};
      ctx.metadata.signalsBuffer = buffer;
    },
    onMetrics: async (ctx: PluginContext) => {
      if (!ctx.flags?.signals) return;
      const buffer: BufferedSignal[] = ctx.metadata?.signalsBuffer || [];
      if (buffer.length === 0) return;
      const snapshotId = getSnapshotIdForMetrics(ctx);
      if (!snapshotId) return;

      const db = getDb();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO signals (
          snapshot_id, url, has_og, og_hash, og_title, og_image, og_url, page_title, canonical_url,
          has_lang, lang, lang_base, has_hreflang, hreflang_count, has_jsonld, jsonld_count,
          schema_types, primary_schema_type, schema_hash, broken_jsonld
        ) VALUES (
          @snapshot_id, @url, @has_og, @og_hash, @og_title, @og_image, @og_url, @page_title, @canonical_url,
          @has_lang, @lang, @lang_base, @has_hreflang, @hreflang_count, @has_jsonld, @jsonld_count,
          @schema_types, @primary_schema_type, @schema_hash, @broken_jsonld
        )
      `);

      const insertTx = db.transaction((rows: BufferedSignal[]) => {
        for (const row of rows) {
          stmt.run({
            snapshot_id: snapshotId,
            url: row.url,
            has_og: row.hasOg,
            og_hash: row.ogHash,
            og_title: row.ogTitle,
            og_image: row.ogImage,
            og_url: row.ogUrl,
            page_title: null,
            canonical_url: row.canonicalUrl,
            has_lang: row.hasLang,
            lang: row.lang,
            lang_base: row.langBase,
            has_hreflang: row.hasHreflang,
            hreflang_count: row.hreflangCount,
            has_jsonld: row.hasJsonld,
            jsonld_count: row.jsonldCount,
            schema_types: JSON.stringify(row.schemaTypes),
            primary_schema_type: row.primarySchemaType,
            schema_hash: row.schemaHash,
            broken_jsonld: row.brokenJsonld
          });
        }
      });
      insertTx(buffer);

      ctx.metadata.signalsReport = computeSignalsReport(snapshotId);
      ctx.metadata.signalsBuffer = [];
    },
    onReport: async (ctx: PluginContext, report: any) => {
      if (!ctx.flags?.signals) return;
      const snapshotId = report?.snapshotId || ctx.snapshotId;
      const signalsReport = ctx.metadata?.signalsReport || (typeof snapshotId === 'number' ? computeSignalsReport(snapshotId) : null);
      if (!signalsReport) return;
      report.plugins = report.plugins || {};
      report.plugins.signals = signalsReport;
    }
  }
};

export default SignalsPlugin;
export { SignalsPlugin };
