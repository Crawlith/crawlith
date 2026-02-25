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

  lines.push(`Pages: ${report.pages} Health Score: ${report.score}/100 Status: ${report.status}`);
  lines.push('');

  const criticalLines: string[] = [];
  if (report.critical.missingTitles > 0) criticalLines.push(`${report.critical.missingTitles} pages missing title`);
  if (report.critical.missingMetaDescriptions > 0) criticalLines.push(`${report.critical.missingMetaDescriptions} pages missing meta description`);
  if (report.critical.accidentalNoindex > 0) criticalLines.push(`${report.critical.accidentalNoindex} pages accidentally noindexed`);
  if (report.critical.severeThinContent > 0) criticalLines.push(`${report.critical.severeThinContent} pages with severe thin content`);

  if (criticalLines.length > 0) {
    lines.push('CRITICAL (Fix Now)');
    lines.push(...criticalLines);
  } else {
    lines.push('No critical issues found.');
  }

  lines.push('');
  lines.push('WARNINGS');
  lines.push(`${report.warnings.missingH1} pages missing H1`);
  lines.push(`${report.warnings.lowWordCount} pages under ${WORD_COUNT_WARNING} words`);
  lines.push(`${report.warnings.thinContent} pages with thin content`);
  lines.push(`${report.warnings.lowInternalLinks} pages with low internal link count`);
  lines.push(`${report.warnings.highExternalLinkRatio} pages with high external link ratio`);
  lines.push(`${report.warnings.missingImageAlt} pages with missing image alt text`);

  const opportunityLines: string[] = [];
  if (report.opportunities.strongPagesUnderlinked > 0) {
    opportunityLines.push(`${report.opportunities.strongPagesUnderlinked} strong pages could pass more link equity`);
  }
  if (report.opportunities.pagesNearGoodThreshold > 0) {
    opportunityLines.push(`${report.opportunities.pagesNearGoodThreshold} pages close to Good status threshold`);
  }

  if (opportunityLines.length > 0) {
    lines.push('');
    lines.push('OPPORTUNITIES');
    lines.push(...opportunityLines);
  }

  lines.push('');
  lines.push(`Avg SEO Score: ${report.summary.avgSeoScore} Thin Pages: ${report.summary.thinPages} Duplicate Titles: ${report.summary.duplicateTitles}`);
  lines.push('');
  lines.push('Top 10 Pages by SEO Score');
  for (const page of report.topPages) {
    lines.push(`${page.url} (Score: ${page.score.toFixed(3)})`);
  }

  return `${lines.join('\n')}\n`;
}
