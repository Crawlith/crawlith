export interface ExtractedSignalRecord {
  url: string;
  title: string;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogType: string | null;
  ogUrl: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  hasOg: boolean;
  ogHash: string | null;
  htmlLang: string | null;
  baseLang: string | null;
  contentLanguage: string | null;
  hasLang: boolean;
  hasHreflang: boolean;
  hreflangCount: number;
  hreflangPairs: Array<{ hreflang: string; href: string }>;
  hasJsonLd: boolean;
  jsonldCount: number;
  schemaTypes: string[];
  primarySchemaType: string | null;
  schemaHash: string | null;
  brokenJsonld: boolean;
}

export interface SignalsReport {
  score: number;
  coverage: {
    ogCoverage: number;
    languageCoverage: number;
    hreflangCoverage: number;
    jsonldCoverage: number;
  };
  brokenJsonLdCount: number;
  schemaTypeDistribution: Array<{ type: string; count: number }>;
  highImpactFixes: string[];
  mediumImpactFixes: string[];
  lowImpactFixes: string[];
  highAuthorityGaps: {
    missingJsonLd: Array<{ url: string; pagerank: number; authority: number; impact: number }>;
    missingOg: Array<{ url: string; pagerank: number; authority: number; impact: number }>;
    missingLang: Array<{ url: string; pagerank: number; authority: number; impact: number }>;
  };
  ogIntelligence: {
    duplicateClusters: Array<{ ogHash: string; count: number }>;
    titleMismatches: number;
    canonicalMismatches: number;
    lowEntropyRisk: boolean;
    titleEntropy: number;
  };
  languageIntelligence: {
    missingLangCount: number;
    hreflangNoReturnCount: number;
    hreflangCanonicalMismatchCount: number;
    mixedPathClusterCount: number;
  };
  schemaIntelligence: {
    concentration: number;
    conflictingPrimaryTypeCount: number;
    productLowInternalLinksCount: number;
    articleLikeMissingArticleCount: number;
    faqLowDepthCount: number;
    identicalSchemaClusters: Array<{ schemaHash: string; count: number }>;
  };
}
