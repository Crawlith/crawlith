import { createHash } from 'node:crypto';
import type { OgMismatchResult, ParsedSignalRecord, RankedSignalRecord, SignalsSummary } from './types.js';

const clean = (input?: string | null): string | null => {
  if (!input) return null;
  const value = input.replace(/\s+/g, ' ').trim();
  return value.length ? value : null;
};

/**
 * Core extraction and scoring logic for structured signals.
 */
export class SignalsService {
  /**
   * Stable hash helper used for clustering and duplicate detection.
   */
  stableHash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private extractSchemaTypesRecursive(input: any, out: Set<string>): void {
    if (Array.isArray(input)) {
      input.forEach((item) => this.extractSchemaTypesRecursive(item, out));
      return;
    }
    if (!input || typeof input !== 'object') return;

    const schemaType = input['@type'];
    if (Array.isArray(schemaType)) {
      schemaType.forEach((entry) => {
        const normalized = clean(String(entry));
        if (normalized) out.add(normalized);
      });
    } else if (schemaType) {
      const normalized = clean(String(schemaType));
      if (normalized) out.add(normalized);
    }

    for (const key in input) {
      if (key !== '@type' && typeof input[key] === 'object') {
        this.extractSchemaTypesRecursive(input[key], out);
      }
    }
  }

  /**
   * Parses social/structured metadata from a page HTML payload.
   */
  parseSignalsFromHtml(html: string, url: string, contentLanguageHeader?: string): ParsedSignalRecord {
    const langMatch = html.match(/<html[^>]*\blang\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/i);
    const lang = clean(langMatch?.[1])?.toLowerCase() ?? clean(contentLanguageHeader)?.toLowerCase() ?? null;
    const langBase = lang ? lang.split('-')[0] : null;

    const canonicalMatch = html.match(/<link[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i);
    const canonicalUrl = clean(canonicalMatch?.[1]);

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = clean(titleMatch?.[1]);

    const meta: Record<string, string> = {};
    const metaRegex = /<meta\s+([^>]+)>/gi;
    let metaMatch: RegExpExecArray | null;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      const tagContent = metaMatch[1];
      const property = tagContent.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      const content = clean(tagContent.match(/content\s*=\s*["']([\s\S]*?)["']/i)?.[1]);
      if (property && content && meta[property] === undefined) meta[property] = content;
    }

    const ogTitle = clean(meta['og:title']);
    const ogDescription = clean(meta['og:description']);
    const ogImage = clean(meta['og:image']);
    const ogUrl = clean(meta['og:url']);
    const twitterTitle = clean(meta['twitter:title']);
    const twitterDescription = clean(meta['twitter:description']);
    const twitterImage = clean(meta['twitter:image']);
    const twitterCard = clean(meta['twitter:card']);

    const hasOg = Number(Boolean(ogTitle || ogDescription || ogImage || ogUrl || twitterTitle || twitterDescription || twitterImage));
    const ogHash = hasOg ? this.stableHash(`${ogTitle ?? ''}|${ogDescription ?? ''}|${ogImage ?? ''}`) : null;

    const hreflangRegex = /<link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*>/gi;
    let hreflangCount = 0;
    while (hreflangRegex.exec(html)) hreflangCount += 1;

    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const schemaTypes = new Set<string>();
    const schemaHashes: string[] = [];
    let jsonldCount = 0;
    let brokenJsonld = 0;

    let jsonLdMatch: RegExpExecArray | null;
    while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
      const raw = clean(jsonLdMatch[1]);
      if (!raw) continue;
      jsonldCount += 1;
      try {
        const parsed = JSON.parse(raw);
        this.extractSchemaTypesRecursive(parsed, schemaTypes);
        schemaHashes.push(this.stableHash(raw));
      } catch {
        brokenJsonld = 1;
      }
    }

    const allTypes = Array.from(schemaTypes);
    return {
      url,
      pageTitle,
      ogTitle,
      ogDescription,
      ogImage,
      ogUrl,
      twitterTitle,
      twitterDescription,
      twitterImage,
      twitterCard,
      hasOg,
      ogHash,
      lang,
      langBase,
      hasLang: Number(Boolean(lang)),
      hasHreflang: Number(hreflangCount > 0),
      hreflangCount,
      canonicalUrl,
      hasJsonld: Number(jsonldCount > 0),
      jsonldCount,
      schemaTypes: allTypes,
      primarySchemaType: allTypes[0] ?? null,
      schemaHash: schemaHashes.length ? this.stableHash(schemaHashes.join('|')) : null,
      brokenJsonld
    };
  }

  /**
   * Assigns a per-page score used by scoreProvider.
   */
  computePageScore(record: ParsedSignalRecord): number {
    const value = (record.hasJsonld * 35) + (record.hasOg * 25) + (record.hasLang * 20) + (record.hasHreflang * 10) - (record.brokenJsonld * 15);
    return Math.max(0, Math.min(100, value));
  }

  /**
   * Produces human friendly status based on numeric score.
   */
  computeStatus(score: number): 'good' | 'warning' | 'poor' {
    if (score >= 80) return 'good';
    if (score >= 50) return 'warning';
    return 'poor';
  }

  /**
   * Detects OG/title and OG/canonical mismatches.
   */
  detectOgMismatches(rows: ParsedSignalRecord[]): OgMismatchResult[] {
    const mismatches: OgMismatchResult[] = [];
    for (const row of rows) {
      if (row.ogTitle && row.pageTitle && row.ogTitle.trim().toLowerCase() !== row.pageTitle.trim().toLowerCase()) {
        mismatches.push({ url: row.url, reason: 'title_mismatch' });
      }
      if (row.ogUrl && row.canonicalUrl && row.ogUrl.trim().toLowerCase() !== row.canonicalUrl.trim().toLowerCase()) {
        mismatches.push({ url: row.url, reason: 'url_mismatch' });
      }
    }
    return mismatches;
  }

  /**
   * Clusters pages by schema hash.
   */
  clusterBySchemaHash(rows: ParsedSignalRecord[]): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    for (const row of rows) {
      if (!row.schemaHash) continue;
      const current = clusters.get(row.schemaHash) ?? [];
      current.push(row.url);
      clusters.set(row.schemaHash, current);
    }
    return clusters;
  }

  /**
   * Builds snapshot-level plugin summary for final report.
   */
  buildReport(records: ParsedSignalRecord[], ranking = new Map<string, { pagerank: number; authority: number }>()): SignalsSummary | null {
    if (records.length === 0) return null;

    const total = records.length;
    const coverage = {
      og: Number(((records.filter((r) => r.hasOg).length / total) * 100).toFixed(2)),
      lang: Number(((records.filter((r) => r.hasLang).length / total) * 100).toFixed(2)),
      hreflang: Number(((records.filter((r) => r.hasHreflang).length / total) * 100).toFixed(2)),
      jsonld: Number(((records.filter((r) => r.hasJsonld).length / total) * 100).toFixed(2))
    };

    const ranked: RankedSignalRecord[] = records.map((row) => {
      const metrics = ranking.get(row.url) ?? { pagerank: 0, authority: 0 };
      return {
        ...row,
        pagerank: metrics.pagerank,
        authority: metrics.authority,
        impact: (metrics.pagerank * 0.6) + (metrics.authority * 0.4)
      };
    });

    const highMissingJsonLd = ranked.filter((r) => !r.hasJsonld).sort((a, b) => b.impact - a.impact).slice(0, 10);
    const highMissingOg = ranked.filter((r) => !r.hasOg).sort((a, b) => b.authority - a.authority).slice(0, 10);
    const mediumMissingLang = ranked.filter((r) => !r.hasLang).sort((a, b) => b.impact - a.impact).slice(0, 10);

    const ogClusters = new Map<string, number>();
    const schemaDistribution = new Map<string, number>();
    for (const row of records) {
      if (row.ogHash) ogClusters.set(row.ogHash, (ogClusters.get(row.ogHash) ?? 0) + 1);
      for (const type of row.schemaTypes) {
        schemaDistribution.set(type, (schemaDistribution.get(type) ?? 0) + 1);
      }
    }

    const duplicateOgClusters = Array.from(ogClusters.entries())
      .filter(([, size]) => size > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([hash, size]) => ({ hash, size }));

    const schemaClusters = this.clusterBySchemaHash(records);
    const schemaTypesTop = Array.from(schemaDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    const authorityGapPenalty = Math.min(100, highMissingJsonLd.reduce((sum, row) => sum + (row.impact * 2), 0));
    const schemaDiversity = schemaDistribution.size > 0 ? Math.min(1, schemaDistribution.size / 12) : 0;

    const score = Math.max(0, Math.min(100,
      (coverage.jsonld * 0.35)
      + (coverage.og * 0.25)
      + (coverage.lang * 0.15)
      + (coverage.hreflang * 0.1)
      + ((1 - (authorityGapPenalty / 100)) * 10)
      + (schemaDiversity * 15)
    ));

    return {
      signalsScore: Number(score.toFixed(2)),
      coverage,
      brokenJsonLdCount: records.filter((r) => r.brokenJsonld).length,
      schemaTypesTop,
      duplicateOgClusters,
      ogMismatches: this.detectOgMismatches(records),
      schemaClusterCount: Array.from(schemaClusters.values()).filter((cluster) => cluster.length > 1).length,
      highImpactFixes: [
        ...highMissingJsonLd.map((row) => ({ impact: 'high' as const, type: 'missing_jsonld', url: row.url })),
        ...highMissingOg.map((row) => ({ impact: 'high' as const, type: 'missing_og', url: row.url }))
      ].slice(0, 10),
      mediumImpactFixes: mediumMissingLang.map((row) => ({ impact: 'medium' as const, type: 'missing_lang', url: row.url })),
      lowImpactFixes: this.detectOgMismatches(records)
        .slice(0, 10)
        .map((item) => ({ impact: 'low' as const, type: item.reason, url: item.url }))
    };
  }
}
