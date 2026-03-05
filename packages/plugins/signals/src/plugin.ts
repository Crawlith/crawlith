import type { PageInput, PluginContext } from '@crawlith/core';
import { SignalsOutput } from './Output.js';
import { SignalsService } from './Service.js';
import type { ParsedSignalRecord, SignalsRow } from './types.js';

const service = new SignalsService();

/**
 * Lifecycle hooks for the signals plugin.
 */
export const SignalsHooks = {
  /**
   * Page-level extraction used by `crawlith page`.
   */
  onPage: async (ctx: PluginContext, page: PageInput): Promise<void> => {
    if (!ctx.flags?.signals || !ctx.db) return;

    const contentLanguage = page.headers?.['content-language'];
    const contentLanguageValue = Array.isArray(contentLanguage) ? contentLanguage[0] : contentLanguage;

    const row = await ctx.db.data.getOrFetch<SignalsRow>(
      page.url,
      async () => {
        const parsed = service.parseSignalsFromHtml(page.html || '', page.url, contentLanguageValue);
        const score = service.computePageScore(parsed);
        return {
          score,
          status: service.computeStatus(score),
          has_og: parsed.hasOg,
          has_lang: parsed.hasLang,
          has_hreflang: parsed.hasHreflang,
          has_jsonld: parsed.hasJsonld,
          broken_jsonld: parsed.brokenJsonld,
          schema_hash: parsed.schemaHash,
          og_hash: parsed.ogHash,
          signals_json: JSON.stringify(parsed)
        } as SignalsRow;
      }
    );

    if (!row) return;
    const parsed = (typeof row.signals_json === 'string' ? JSON.parse(row.signals_json) : row.signals_json) as ParsedSignalRecord;

    ctx.metadata = ctx.metadata || {};
    ctx.metadata.signalsRows = [parsed];
  },

  /**
   * Crawl-level extraction and aggregation on the computed graph.
   */
  onMetrics: async (ctx: PluginContext, graph: any): Promise<void> => {
    if (!ctx.flags?.signals || !ctx.db) return;

    const nodes = graph?.getNodes?.();
    if (!Array.isArray(nodes)) return;

    const parsedRows: ParsedSignalRecord[] = [];
    const ranking = new Map<string, { pagerank: number; authority: number }>();

    for (const node of nodes) {
      const url = node?.url;
      if (!url) continue;
      // Signals should run only on internal pages that were actually fetched.
      if (node?.isInternal === false) continue;
      if (typeof node?.status === 'number' && node.status <= 0) continue;

      const headerValue = node?.headers?.['content-language'];
      const contentLanguageValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      let row: SignalsRow | null = null;
      try {
        row = await ctx.db.data.getOrFetch<SignalsRow>(
          url,
          async () => {
            const parsed = service.parseSignalsFromHtml(node?.html || '', url, contentLanguageValue);
            const score = service.computePageScore(parsed);
            return {
              score,
              status: service.computeStatus(score),
              has_og: parsed.hasOg,
              has_lang: parsed.hasLang,
              has_hreflang: parsed.hasHreflang,
              has_jsonld: parsed.hasJsonld,
              broken_jsonld: parsed.brokenJsonld,
              schema_hash: parsed.schemaHash,
              og_hash: parsed.ogHash,
              signals_json: JSON.stringify(parsed)
            } as SignalsRow;
          }
        );
      } catch (error) {
        ctx.logger?.warn?.(`[plugin:signals] Skipping ${url}: ${(error as Error).message}`);
        continue;
      }

      if (!row) continue;
      const parsed = (typeof row.signals_json === 'string' ? JSON.parse(row.signals_json) : row.signals_json) as ParsedSignalRecord;

      parsedRows.push(parsed);
      ranking.set(url, {
        pagerank: Number(node.pageRankScore ?? node.pageRank ?? 0),
        authority: Number(node.authorityScore ?? 0)
      });

      (node as any).signals = {
        score: row.score,
        status: row.status,
        hasJsonld: parsed.hasJsonld,
        hasOg: parsed.hasOg,
        hasLang: parsed.hasLang
      };
    }

    const summary = service.buildReport(parsedRows, ranking);
    if (!summary) return;

    ctx.metadata = ctx.metadata || {};
    ctx.metadata.signalsRows = parsedRows;
    ctx.metadata.signalsSummary = summary;
    SignalsOutput.emitSummary(ctx, summary);
  },

  /**
   * Attaches computed signals summary to the final report.
   */
  onReport: async (ctx: PluginContext, result: any): Promise<void> => {
    if (!ctx.flags?.signals || !ctx.db) return;

    let summary = ctx.metadata?.signalsSummary;
    if (!summary) {
      const rows = ctx.db.data.all<SignalsRow>();
      const parsedRows = rows.map((row: SignalsRow) => (typeof row.signals_json === 'string' ? JSON.parse(row.signals_json) : row.signals_json) as ParsedSignalRecord);
      summary = service.buildReport(parsedRows);
    }

    if (!summary) return;
    result.plugins = result.plugins || {};
    result.plugins.signals = summary;
  }
};
