import { createRequire } from 'node:module';
import { Command, getDb, type CrawlithPlugin, type PluginContext } from '@crawlith/core';
import { extractSignalsFromHtml } from './src/extractor.js';
import { runSignalsAnalysis } from './src/signalsRunner.js';
import { ExtractedSignalRecord } from './src/types.js';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const extractedSignals = new Map<string, ExtractedSignalRecord>();

/** Persist extracted signals in a compact snapshot-scoped table. */
function persistSignals(snapshotId: number, rows: ExtractedSignalRecord[]): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO signals (
      snapshot_id, url, has_og, og_hash, og_title, og_image, og_url,
      has_lang, lang, has_hreflang, hreflang_count,
      has_jsonld, jsonld_count, schema_types, primary_schema_type, schema_hash, broken_jsonld
    ) VALUES (
      @snapshot_id, @url, @has_og, @og_hash, @og_title, @og_image, @og_url,
      @has_lang, @lang, @has_hreflang, @hreflang_count,
      @has_jsonld, @jsonld_count, @schema_types, @primary_schema_type, @schema_hash, @broken_jsonld
    )
  `);

  const transaction = db.transaction((batch: ExtractedSignalRecord[]) => {
    for (const row of batch) {
      insert.run({
        snapshot_id: snapshotId,
        url: row.url,
        has_og: row.hasOg ? 1 : 0,
        og_hash: row.ogHash,
        og_title: row.ogTitle,
        og_image: row.ogImage,
        og_url: row.ogUrl,
        has_lang: row.hasLang ? 1 : 0,
        lang: row.baseLang || row.contentLanguage || row.htmlLang,
        has_hreflang: row.hasHreflang ? 1 : 0,
        hreflang_count: row.hreflangCount,
        has_jsonld: row.hasJsonLd ? 1 : 0,
        jsonld_count: row.jsonldCount,
        schema_types: JSON.stringify(row.schemaTypes),
        primary_schema_type: row.primarySchemaType,
        schema_hash: row.schemaHash,
        broken_jsonld: row.brokenJsonld ? 1 : 0
      });
    }
  });

  transaction(rows);
}

export const SignalsPlugin: CrawlithPlugin = {
  name: 'signals',
  version: pkg.version,
  description: pkg.description,
  register: (cli: Command) => {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
      cli.option('--signals', 'Enable structured search signal intelligence analysis');
    }
  },
  hooks: {
    onInit: async () => {
      extractedSignals.clear();
    },
    onPageParsed: async (_ctx: PluginContext, page: any) => {
      if (!page?.url || !page?.html) return;
      const contentLanguageHeader = page.headers?.['content-language'];
      const value = Array.isArray(contentLanguageHeader) ? contentLanguageHeader[0] : contentLanguageHeader;
      extractedSignals.set(page.url, extractSignalsFromHtml(page.url, page.html, value));
    },
    onMetrics: async (ctx: PluginContext, graph: any) => {
      if (!ctx.flags?.signals) return;
      const snapshotId = Number(ctx.snapshotId || ctx.metadata?.snapshotId || 0);
      if (!snapshotId) return;

      const rows = Array.from(extractedSignals.values());
      persistSignals(snapshotId, rows);

      const report = runSignalsAnalysis(graph, rows);
      ctx.metadata = ctx.metadata || {};
      ctx.metadata.signalsReport = report;
    },
    onReport: async (ctx: PluginContext, result: any) => {
      if (!ctx.flags?.signals) return;
      const report = ctx.metadata?.signalsReport;
      if (!report) return;
      result.plugins = result.plugins || {};
      result.plugins.signals = report;
    }
  }
};

export default SignalsPlugin;
