/**
 * Parsed per-page social/structured signal snapshot.
 */
export interface ParsedSignalRecord {
  url: string;
  pageTitle: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  twitterCard: string | null;
  hasOg: number;
  ogHash: string | null;
  lang: string | null;
  langBase: string | null;
  hasLang: number;
  hasHreflang: number;
  hreflangCount: number;
  canonicalUrl: string | null;
  hasJsonld: number;
  jsonldCount: number;
  schemaTypes: string[];
  primarySchemaType: string | null;
  schemaHash: string | null;
  brokenJsonld: number;
}

/**
 * Persisted row shape for ctx.db.data.getOrFetch/find/all.
 */
export interface SignalsRow {
  score: number;
  status: 'good' | 'warning' | 'poor';
  has_og: number;
  has_lang: number;
  has_hreflang: number;
  has_jsonld: number;
  broken_jsonld: number;
  schema_hash: string | null;
  og_hash: string | null;
  signals_json: string | ParsedSignalRecord;
}

export interface OgMismatchResult {
  url: string;
  reason: 'title_mismatch' | 'url_mismatch';
}

export interface SignalsSummary {
  signalsScore: number;
  coverage: {
    og: number;
    lang: number;
    hreflang: number;
    jsonld: number;
  };
  brokenJsonLdCount: number;
  schemaTypesTop: Array<{ type: string; count: number }>;
  duplicateOgClusters: Array<{ hash: string; size: number }>;
  ogMismatches: OgMismatchResult[];
  schemaClusterCount: number;
  highImpactFixes: Array<{ impact: 'high'; type: string; url: string }>;
  mediumImpactFixes: Array<{ impact: 'medium'; type: string; url: string }>;
  lowImpactFixes: Array<{ impact: 'low'; type: string; url: string }>;
}

export interface RankedSignalRecord extends ParsedSignalRecord {
  authority: number;
  pagerank: number;
  impact: number;
}
