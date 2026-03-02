import { ExtractedSignalRecord, SignalsReport } from './types.js';
import { computeEntropy } from './extractor.js';

interface MetricsRow {
  url: string;
  pagerank: number;
  authority: number;
  inLinks: number;
}

const percent = (numerator: number, denominator: number): number => denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2));
const impact = (row: MetricsRow): number => Number(((row.pagerank * 0.6) + (row.authority * 0.4)).toFixed(6));

/** Runs post-crawl intelligence over extracted signal rows using a single bulk pass. */
export function runSignalsAnalysis(graph: { getNodes(): Array<{ url: string; pageRank?: number; authorityScore?: number; inLinks?: number }> }, records: ExtractedSignalRecord[]): SignalsReport {
  const total = records.length;
  const nodes = graph.getNodes();
  const metricByUrl = new Map<string, MetricsRow>();

  for (const node of nodes) {
    metricByUrl.set(node.url, {
      url: node.url,
      pagerank: node.pageRank ?? 0,
      authority: node.authorityScore ?? 0,
      inLinks: node.inLinks ?? 0
    });
  }

  const schemaDistribution = new Map<string, number>();
  const ogHashBuckets = new Map<string, number>();
  const schemaHashBuckets = new Map<string, number>();
  const langByPathPrefix = new Map<string, Set<string>>();

  let hasOg = 0;
  let hasLang = 0;
  let hasHreflang = 0;
  let hasJsonLd = 0;
  let brokenJsonLdCount = 0;
  let titleMismatchCount = 0;
  let canonicalMismatchCount = 0;
  let hreflangNoReturnCount = 0;
  let hreflangCanonicalMismatchCount = 0;
  let productLowLinks = 0;
  let articleLikeMissingArticle = 0;
  let faqLowDepthCount = 0;
  let conflictingPrimaryTypeCount = 0;

  const missingJsonLd: MetricsRow[] = [];
  const missingOg: MetricsRow[] = [];
  const missingLang: MetricsRow[] = [];

  for (const record of records) {
    if (record.hasOg) hasOg += 1;
    if (record.hasLang) hasLang += 1;
    if (record.hasHreflang) hasHreflang += 1;
    if (record.hasJsonLd) hasJsonLd += 1;
    if (record.brokenJsonld) brokenJsonLdCount += 1;

    if (record.ogHash) ogHashBuckets.set(record.ogHash, (ogHashBuckets.get(record.ogHash) || 0) + 1);
    if (record.schemaHash) schemaHashBuckets.set(record.schemaHash, (schemaHashBuckets.get(record.schemaHash) || 0) + 1);

    const normalizedTitle = record.title.trim().toLowerCase();
    const normalizedOgTitle = (record.ogTitle || '').trim().toLowerCase();
    if (normalizedTitle && normalizedOgTitle && normalizedTitle !== normalizedOgTitle) titleMismatchCount += 1;

    if (record.ogUrl && record.canonical && record.ogUrl !== record.canonical) canonicalMismatchCount += 1;
    if (record.hasHreflang && !record.canonical) hreflangCanonicalMismatchCount += 1;

    const pathPrefix = new URL(record.url).pathname.split('/').slice(0, 2).join('/') || '/';
    if (!langByPathPrefix.has(pathPrefix)) langByPathPrefix.set(pathPrefix, new Set());
    if (record.baseLang) langByPathPrefix.get(pathPrefix)?.add(record.baseLang);

    if (record.hreflangPairs.length > 0) {
      const targetLangs = new Set(record.hreflangPairs.map((pair) => pair.hreflang));
      if (record.baseLang && !targetLangs.has(record.baseLang)) hreflangNoReturnCount += 1;
    }

    for (const schemaType of record.schemaTypes) {
      schemaDistribution.set(schemaType, (schemaDistribution.get(schemaType) || 0) + 1);
    }

    if (record.schemaTypes.length > 1) conflictingPrimaryTypeCount += 1;

    const metrics = metricByUrl.get(record.url) || { url: record.url, pagerank: 0, authority: 0, inLinks: 0 };
    if (!record.hasJsonLd) missingJsonLd.push(metrics);
    if (!record.hasOg) missingOg.push(metrics);
    if (!record.hasLang) missingLang.push(metrics);

    if (record.schemaTypes.includes('Product') && metrics.inLinks < 3) productLowLinks += 1;
    if (record.url.includes('/blog') && !record.schemaTypes.includes('Article')) articleLikeMissingArticle += 1;
    if (record.schemaTypes.includes('FAQPage') && metrics.inLinks < 2) faqLowDepthCount += 1;
  }

  const mixedPathClusterCount = Array.from(langByPathPrefix.values()).filter((langs) => langs.size > 1).length;
  const duplicateOgClusters = Array.from(ogHashBuckets.entries()).filter(([, count]) => count > 1).map(([ogHash, count]) => ({ ogHash, count }));
  const identicalSchemaClusters = Array.from(schemaHashBuckets.entries()).filter(([, count]) => count > 1).map(([schemaHash, count]) => ({ schemaHash, count }));

  const schemaTypesSorted = Array.from(schemaDistribution.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  const entropyScore = computeEntropy(Array.from(ogHashBuckets.values()));
  const lowEntropyRisk = entropyScore < Math.log2(Math.max(2, total / 10));

  const sortByImpact = (rows: MetricsRow[]) =>
    rows
      .map((row) => ({ ...row, impact: impact(row) }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 20)
      .map(({ url, pagerank, authority, impact: i }) => ({ url, pagerank, authority, impact: i }));

  const topMissingJsonLd = sortByImpact(missingJsonLd);
  const topMissingOg = sortByImpact(missingOg);
  const topMissingLang = sortByImpact(missingLang);

  const jsonLdCoverage = percent(hasJsonLd, total);
  const ogCoverage = percent(hasOg, total);
  const languageCoverage = percent(hasLang, total);
  const hreflangCoverage = percent(hasHreflang, total);

  const authorityWeightedGap = percent(
    topMissingJsonLd.reduce((sum, row) => sum + row.impact, 0),
    Math.max(0.0001, nodes.reduce((sum, node) => sum + ((node.pageRank ?? 0) * 0.6 + (node.authorityScore ?? 0) * 0.4), 0))
  );

  const hreflangIntegrity = Math.max(0, 100 - ((hreflangNoReturnCount + hreflangCanonicalMismatchCount) * 100 / Math.max(1, total)));
  const schemaConsistency = Math.max(0, 100 - ((identicalSchemaClusters.length + productLowLinks + articleLikeMissingArticle) * 100 / Math.max(1, total * 2)));

  const score = Math.max(0, Math.min(100,
    (jsonLdCoverage * 0.30) +
    ((100 - authorityWeightedGap) * 0.20) +
    (ogCoverage * 0.15) +
    (languageCoverage * 0.10) +
    (hreflangIntegrity * 0.10) +
    (schemaConsistency * 0.15)
  ));

  return {
    score: Number(score.toFixed(2)),
    coverage: {
      ogCoverage,
      languageCoverage,
      hreflangCoverage,
      jsonldCoverage: jsonLdCoverage
    },
    brokenJsonLdCount,
    schemaTypeDistribution: schemaTypesSorted,
    highImpactFixes: [
      `Add JSON-LD to top authority pages (${topMissingJsonLd.length} high-impact gaps).`,
      `Resolve broken JSON-LD scripts (${brokenJsonLdCount} affected pages).`,
      `Fix OG title/canonical mismatches (${titleMismatchCount + canonicalMismatchCount} pages).`
    ],
    mediumImpactFixes: [
      `Backfill missing og:* metadata on high-equity pages (${topMissingOg.length} in top impact cohort).`,
      `Fix hreflang reciprocity issues (${hreflangNoReturnCount} pages).`
    ],
    lowImpactFixes: [
      `Normalize language clustering consistency across paths (${mixedPathClusterCount} mixed clusters).`
    ],
    highAuthorityGaps: {
      missingJsonLd: topMissingJsonLd,
      missingOg: topMissingOg,
      missingLang: topMissingLang
    },
    ogIntelligence: {
      duplicateClusters: duplicateOgClusters,
      titleMismatches: titleMismatchCount,
      canonicalMismatches: canonicalMismatchCount,
      lowEntropyRisk,
      titleEntropy: Number(entropyScore.toFixed(3))
    },
    languageIntelligence: {
      missingLangCount: total - hasLang,
      hreflangNoReturnCount,
      hreflangCanonicalMismatchCount,
      mixedPathClusterCount
    },
    schemaIntelligence: {
      concentration: schemaTypesSorted[0]?.count || 0,
      conflictingPrimaryTypeCount,
      productLowInternalLinksCount: productLowLinks,
      articleLikeMissingArticleCount: articleLikeMissingArticle,
      faqLowDepthCount,
      identicalSchemaClusters
    }
  };
}
