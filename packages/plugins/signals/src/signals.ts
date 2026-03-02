import { createHash } from 'node:crypto';

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

export interface OgMismatchResult { url: string; reason: 'title_mismatch' | 'url_mismatch'; }

const clean = (input?: string | null): string | null => {
  if (!input) return null;
  const value = input.replace(/\s+/g, ' ').trim();
  return value.length ? value : null;
};

/**
 * Stable SHA-256 helper for compact clustering keys.
 */
export function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function extractSchemaTypesRecursive(input: any, out: Set<string>): void {
  if (Array.isArray(input)) {
    input.forEach(item => extractSchemaTypesRecursive(item, out));
    return;
  }
  if (!input || typeof input !== 'object') return;

  const t = input['@type'];
  if (Array.isArray(t)) {
    t.forEach(entry => {
      const c = clean(String(entry));
      if (c) out.add(c);
    });
  } else if (t) {
    const c = clean(String(t));
    if (c) out.add(c);
  }

  // Descend into properties that might contain nested types (Graph pattern)
  for (const key in input) {
    if (key !== '@type' && typeof input[key] === 'object') {
      extractSchemaTypesRecursive(input[key], out);
    }
  }
}

/**
 * Parse and normalize structured search signals from raw HTML.
 */
export function parseSignalsFromHtml(html: string, url: string, contentLanguageHeader?: string): ParsedSignalRecord {
  const langMatch = html.match(/<html[^>]*\blang\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/i);
  const lang = clean(langMatch?.[1])?.toLowerCase() ?? clean(contentLanguageHeader)?.toLowerCase() ?? null;
  const langBase = lang ? lang.split('-')[0] : null;

  const canonicalMatch = html.match(/<link[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  const canonicalUrl = clean(canonicalMatch?.[1]);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = clean(titleMatch?.[1]);

  // Enhanced Meta Extraction
  const meta: Record<string, string> = {};
  const metaRegex = /<meta\s+([^>]+)>/gi;
  let m;
  while ((m = metaRegex.exec(html)) !== null) {
    const tagContent = m[1];
    const property = tagContent.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = clean(tagContent.match(/content\s*=\s*["']([\s\S]*?)["']/i)?.[1]);
    if (property && content && meta[property] === undefined) {
      meta[property] = content;
    }
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
  const ogHash = hasOg ? stableHash(`${ogTitle ?? ''}|${ogDescription ?? ''}|${ogImage ?? ''}`) : null;

  // Robust Hreflang extraction
  const hreflangRegex = /<link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*>/gi;
  let hreflangCount = 0;
  while (hreflangRegex.exec(html)) hreflangCount++;

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
      extractSchemaTypesRecursive(parsed, schemaTypes);
      schemaHashes.push(stableHash(raw));
    } catch {
      brokenJsonld = 1;
    }
  }

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
    schemaTypes: Array.from(schemaTypes),
    primarySchemaType: Array.from(schemaTypes)[0] ?? null,
    schemaHash: schemaHashes.length ? stableHash(schemaHashes.join('|')) : null,
    brokenJsonld
  };
}

/**
 * Detect OG/title and OG/canonical mismatches.
 */
export function detectOgMismatches(rows: Array<{ url: string; og_title: string | null; page_title: string | null; og_url: string | null; canonical_url: string | null; }>): OgMismatchResult[] {
  const mismatches: OgMismatchResult[] = [];
  for (const row of rows) {
    if (row.og_title && row.page_title && row.og_title.trim().toLowerCase() !== row.page_title.trim().toLowerCase()) {
      mismatches.push({ url: row.url, reason: 'title_mismatch' });
    }
    if (row.og_url && row.canonical_url && row.og_url.trim().toLowerCase() !== row.canonical_url.trim().toLowerCase()) {
      mismatches.push({ url: row.url, reason: 'url_mismatch' });
    }
  }
  return mismatches;
}

/**
 * Cluster pages sharing the same schema hash.
 */
export function clusterBySchemaHash(rows: Array<{ url: string; schema_hash: string | null }>): Map<string, string[]> {
  const clusters = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.schema_hash) continue;
    const current = clusters.get(row.schema_hash) ?? [];
    current.push(row.url);
    clusters.set(row.schema_hash, current);
  }
  return clusters;
}
