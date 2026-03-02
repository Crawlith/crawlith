import { createHash } from 'node:crypto';
import { ExtractedSignalRecord } from './types.js';

const normalize = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizedLang = (value?: string | null): string | null => {
  const cleaned = normalize(value);
  return cleaned ? cleaned.toLowerCase() : null;
};

const getBaseLang = (value?: string | null): string | null => {
  const lang = normalizedLang(value);
  return lang ? (lang.split('-')[0] || null) : null;
};

const hashValue = (value: string): string => createHash('sha256').update(value).digest('hex');

function getTagContent(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
  const match = html.match(re);
  return normalize(match?.[1] || null);
}

function getMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]*(?:property|name)=['\"]${escaped}['\"][^>]*content=['\"]([^'\"]+)['\"][^>]*>`, 'i'),
    new RegExp(`<meta[^>]*content=['\"]([^'\"]+)['\"][^>]*(?:property|name)=['\"]${escaped}['\"][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return normalize(match[1]);
  }
  return null;
}

function getAttrFromTag(html: string, tagPattern: RegExp, attr: string): string | null {
  const tagMatch = html.match(tagPattern);
  if (!tagMatch) return null;
  const attrMatch = tagMatch[0].match(new RegExp(`${attr}=['\"]([^'\"]+)['\"]`, 'i'));
  return normalize(attrMatch?.[1] || null);
}

function extractSchemaTypes(input: unknown, out: Set<string>): void {
  if (Array.isArray(input)) return input.forEach((item) => extractSchemaTypes(item, out));
  if (!input || typeof input !== 'object') return;
  const record = input as Record<string, unknown>;
  const t = record['@type'];
  if (typeof t === 'string') out.add(t.trim());
  else if (Array.isArray(t)) for (const item of t) if (typeof item === 'string') out.add(item.trim());
  const graph = record['@graph'];
  if (Array.isArray(graph)) graph.forEach((item) => extractSchemaTypes(item, out));
}

export function extractSignalsFromHtml(url: string, html: string, contentLanguageHeader?: string): ExtractedSignalRecord {
  const ogTitle = getMetaContent(html, 'og:title');
  const ogDescription = getMetaContent(html, 'og:description');
  const ogImage = getMetaContent(html, 'og:image');
  const ogType = getMetaContent(html, 'og:type');
  const ogUrl = getMetaContent(html, 'og:url');
  const twitterCard = getMetaContent(html, 'twitter:card');
  const twitterTitle = getMetaContent(html, 'twitter:title');
  const twitterDescription = getMetaContent(html, 'twitter:description');
  const twitterImage = getMetaContent(html, 'twitter:image');

  const htmlLang = normalizedLang(getAttrFromTag(html, /<html[^>]*>/i, 'lang'));
  const contentLanguage = normalizedLang(contentLanguageHeader);

  const hreflangPairs: Array<{ hreflang: string; href: string }> = [];
  const hreflangRegex = /<link[^>]*rel=['"]alternate['"][^>]*>/gi;
  for (const match of html.matchAll(hreflangRegex)) {
    const tag = match[0];
    const hreflang = normalizedLang((tag.match(/hreflang=['"]([^'"]+)['"]/i)?.[1]) || null);
    const href = normalize((tag.match(/href=['"]([^'"]+)['"]/i)?.[1]) || null);
    if (href) hreflangPairs.push({ hreflang: hreflang || 'x-default', href });
  }

  const schemaTypes = new Set<string>();
  let brokenJsonld = false;
  const rawPayloads: string[] = [];
  const jsonLdRegex = /<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(jsonLdRegex)) {
    const raw = normalize(match[1]) || '';
    if (!raw) {
      brokenJsonld = true;
      continue;
    }
    rawPayloads.push(raw);
    try {
      extractSchemaTypes(JSON.parse(raw), schemaTypes);
    } catch {
      brokenJsonld = true;
    }
  }

  const hasOg = Boolean(ogTitle || ogDescription || ogImage || ogType || ogUrl || twitterCard || twitterTitle || twitterDescription || twitterImage);
  const schemaTypeList = Array.from(schemaTypes);

  return {
    url,
    title: getTagContent(html, 'title') || '',
    canonical: getAttrFromTag(html, /<link[^>]*rel=['"]canonical['"][^>]*>/i, 'href'),
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    ogUrl,
    twitterCard,
    twitterTitle,
    twitterDescription,
    twitterImage,
    hasOg,
    ogHash: hasOg ? hashValue(`${ogTitle || ''}|${ogDescription || ''}|${ogImage || ''}`) : null,
    htmlLang,
    baseLang: getBaseLang(htmlLang || contentLanguage),
    contentLanguage,
    hasLang: Boolean(htmlLang || contentLanguage),
    hasHreflang: hreflangPairs.length > 0,
    hreflangCount: hreflangPairs.length,
    hreflangPairs,
    hasJsonLd: rawPayloads.length > 0,
    jsonldCount: rawPayloads.length,
    schemaTypes: schemaTypeList,
    primarySchemaType: schemaTypeList[0] || null,
    schemaHash: rawPayloads.length > 0 ? hashValue(rawPayloads.join('|')) : null,
    brokenJsonld
  };
}

export function computeEntropy(counts: number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  return counts.reduce((sum, count) => {
    if (count <= 0) return sum;
    const probability = count / total;
    return sum - (probability * Math.log2(probability));
  }, 0);
}
