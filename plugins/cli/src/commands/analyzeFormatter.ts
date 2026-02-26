export interface AnalyzeInsightPage {
  url: string;
  status: number;
  seoScore: number;
  thinScore: number;
  title: { status: string };
  metaDescription: { status: string };
  h1: { count: number };
  content: { wordCount: number };
  images: { missingAlt: number };
  links: { internalLinks: number; externalRatio: number };
  meta: { noindex?: boolean };
}

export interface AnalyzeInsightResult {
  site_summary: {
    pages_analyzed: number;
    avg_seo_score: number;
    thin_pages: number;
    duplicate_titles: number;
    site_score: number;
  };
  pages: AnalyzeInsightPage[];
}

export interface AnalyzeInsightReport {
  pages: number;
  score: number;
  status: string;
  critical: {
    missingTitles: number;
    missingMetaDescriptions: number;
    accidentalNoindex: number;
    severeThinContent: number;
  };
  warnings: {
    missingH1: number;
    thinContent: number;
    lowWordCount: number;
    highExternalLinkRatio: number;
    missingImageAlt: number;
    lowInternalLinks: number;
  };
  opportunities: {
    strongPagesUnderlinked: number;
    pagesNearGoodThreshold: number;
  };
  summary: {
    avgSeoScore: number;
    thinPages: number;
    duplicateTitles: number;
  };
  topPages: { url: string; score: number }[];
}

const THIN_WARNING = 70;
const THIN_CRITICAL = 85;
const WORD_COUNT_WARNING = 300;
const HIGH_EXTERNAL_RATIO = 0.6;
const LOW_INTERNAL_LINKS = 2;

export function statusLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'Critical';
}

export function buildAnalyzeInsightReport(result: AnalyzeInsightResult): AnalyzeInsightReport {
  const pages = result.pages;

  const critical = {
    missingTitles: pages.filter((p) => p.title.status === 'missing').length,
    missingMetaDescriptions: pages.filter((p) => p.metaDescription.status === 'missing').length,
    accidentalNoindex: pages.filter((p) => p.meta.noindex && p.status >= 200 && p.status < 300).length,
    severeThinContent: pages.filter((p) => p.thinScore >= THIN_CRITICAL).length
  };

  const warnings = {
    missingH1: pages.filter((p) => p.h1.count === 0).length,
    thinContent: pages.filter((p) => p.thinScore >= THIN_WARNING).length,
    lowWordCount: pages.filter((p) => p.content.wordCount < WORD_COUNT_WARNING).length,
    highExternalLinkRatio: pages.filter((p) => p.links.externalRatio > HIGH_EXTERNAL_RATIO).length,
    missingImageAlt: pages.filter((p) => p.images.missingAlt > 0).length,
    lowInternalLinks: pages.filter((p) => p.links.internalLinks < LOW_INTERNAL_LINKS).length
  };

  const opportunities = {
    strongPagesUnderlinked: pages.filter((p) => p.seoScore >= 80 && p.links.internalLinks < 3).length,
    pagesNearGoodThreshold: pages.filter((p) => p.seoScore >= 70 && p.seoScore < 75).length
  };

  const topPages = [...pages]
    .sort((a, b) => b.seoScore - a.seoScore)
    .slice(0, 10)
    .map((p) => ({ url: p.url, score: p.seoScore }));

  return {
    pages: result.site_summary.pages_analyzed,
    score: Math.round(result.site_summary.site_score),
    status: statusLabel(result.site_summary.site_score),
    critical,
    warnings,
    opportunities,
    summary: {
      avgSeoScore: Math.round(result.site_summary.avg_seo_score),
      thinPages: result.site_summary.thin_pages,
      duplicateTitles: result.site_summary.duplicate_titles
    },
    topPages
  };
}

export function hasAnalyzeCriticalIssues(report: AnalyzeInsightReport): boolean {
  return Object.values(report.critical).some((count) => count > 0);
}
export function renderAnalyzeInsightOutput(report: AnalyzeInsightReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`CRAWLITH — Analyze`);
  lines.push('');
  lines.push(`${report.pages} pages scanned`);
  lines.push('');
  lines.push(
    `Health      ${report.score}/100   ${report.status}`
  );
  lines.push('');

  // ===== Critical =====
  const critical: string[] = [];

  if (report.critical.missingTitles > 0)
    critical.push(`${report.critical.missingTitles} pages missing title`);

  if (report.critical.missingMetaDescriptions > 0)
    critical.push(`${report.critical.missingMetaDescriptions} pages missing meta description`);

  if (report.critical.accidentalNoindex > 0)
    critical.push(`${report.critical.accidentalNoindex} pages accidentally noindexed`);

  if (report.critical.severeThinContent > 0)
    critical.push(`${report.critical.severeThinContent} pages with severe thin content`);

  if (critical.length > 0) {
    lines.push(`Critical`);
    for (const c of critical) lines.push(`  • ${c}`);
    lines.push('');
  }

  // ===== Warnings (only show non-zero) =====
  const warnings: string[] = [];

  if (report.warnings.missingH1 > 0)
    warnings.push(`${report.warnings.missingH1} pages missing H1`);

  if (report.warnings.lowWordCount > 0)
    warnings.push(`${report.warnings.lowWordCount} pages under ${WORD_COUNT_WARNING} words`);

  if (report.warnings.thinContent > 0)
    warnings.push(`${report.warnings.thinContent} pages with thin content`);

  if (report.warnings.lowInternalLinks > 0)
    warnings.push(`${report.warnings.lowInternalLinks} pages with low internal links`);

  if (report.warnings.highExternalLinkRatio > 0)
    warnings.push(`${report.warnings.highExternalLinkRatio} pages with high external ratio`);

  if (report.warnings.missingImageAlt > 0)
    warnings.push(`${report.warnings.missingImageAlt} pages missing image alt`);

  if (warnings.length > 0) {
    lines.push(`Warnings`);
    for (const w of warnings) lines.push(`  • ${w}`);
    lines.push('');
  }

  // ===== Opportunities =====
  const opportunities: string[] = [];

  if (report.opportunities.strongPagesUnderlinked > 0)
    opportunities.push(
      `${report.opportunities.strongPagesUnderlinked} strong pages could pass more authority`
    );

  if (report.opportunities.pagesNearGoodThreshold > 0)
    opportunities.push(
      `${report.opportunities.pagesNearGoodThreshold} pages close to Good threshold`
    );

  if (opportunities.length > 0) {
    lines.push(`Opportunities`);
    for (const o of opportunities) lines.push(`  • ${o}`);
    lines.push('');
  }

  // ===== Summary =====
  lines.push(`Overview`);
  lines.push(`  Avg SEO Score     ${report.summary.avgSeoScore}`);
  lines.push(`  Thin Pages        ${report.summary.thinPages}`);
  lines.push(`  Duplicate Titles  ${report.summary.duplicateTitles}`);
  lines.push('');

  // ===== Top Pages =====
  if (report.topPages.length > 0) {
    lines.push(`Top Pages`);
    for (const page of report.topPages.slice(0, 10)) {
      lines.push(
        `  ${page.url}   ${page.score.toFixed(1)}`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
