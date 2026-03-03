import { Metrics } from '../graph/metrics.js';
import type { PageAnalysis } from './analyze.js';

export interface SiteScore {
  seoHealthScore: number;
  authorityEntropyOrphanScore: number;
  overallScore: number;
}

export function scorePageSeo(page: PageAnalysis): number {
  if (page.meta.crawlStatus === 'blocked_by_robots') {
    return 0;
  }
  const titleMeta = (scoreTextStatus(page.title.status) + scoreTextStatus(page.metaDescription.status)) / 2;
  const h1 = page.h1.status === 'ok' ? 100 : page.h1.status === 'warning' ? 60 : 10;
  const wordQuality = Math.min(100, (page.content.wordCount / 600) * 100) * 0.7 + Math.min(100, page.content.textHtmlRatio * 500) * 0.3;
  const thin = 100 - page.thinScore;
  const imageDen = Math.max(1, page.images.totalImages);
  const imageAlt = Math.max(0, 100 - ((page.images.missingAlt + page.images.emptyAlt) / imageDen) * 100);
  const structured = page.structuredData.present ? (page.structuredData.valid ? 100 : 40) : 30;
  const linkBalance = Math.max(0, 100 - Math.abs(page.links.externalRatio - 0.3) * 200);

  const score =
    titleMeta * 0.15 +
    h1 * 0.1 +
    wordQuality * 0.2 +
    thin * 0.2 +
    imageAlt * 0.1 +
    structured * 0.1 +
    linkBalance * 0.15;

  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

function scoreTextStatus(status: PageAnalysis['title']['status']): number {
  switch (status) {
    case 'ok': return 100;
    case 'duplicate': return 45;
    case 'too_short': return 60;
    case 'too_long': return 60;
    case 'missing': return 0;
  }
}

export function aggregateSiteScore(metrics: Metrics, pages: PageAnalysis[]): SiteScore {
  const seoHealthScore = pages.length === 0 ? 0 : pages.reduce((acc, page) => acc + page.seoScore, 0) / pages.length;

  const avgAuthority = metrics.topAuthorityPages.length === 0
    ? 0
    : metrics.topAuthorityPages.reduce((acc, item) => acc + item.authority, 0) / metrics.topAuthorityPages.length;
  const entropyScore = Math.max(0, 100 - Math.abs(metrics.structuralEntropy - 2) * 25);
  const orphanPenalty = metrics.totalPages === 0 ? 0 : (metrics.orphanPages.length / metrics.totalPages) * 100;
  const authorityEntropyOrphanScore = Math.max(0, Math.min(100, (avgAuthority * 100 * 0.4) + (entropyScore * 0.35) + ((100 - orphanPenalty) * 0.25)));

  let overallScore = Number((seoHealthScore * 0.7 + authorityEntropyOrphanScore * 0.3).toFixed(2));

  if (pages.some(p => p.meta.crawlStatus === 'blocked_by_robots')) {
    overallScore = 0;
  }

  return {
    seoHealthScore: Number(seoHealthScore.toFixed(2)),
    authorityEntropyOrphanScore: Number(authorityEntropyOrphanScore.toFixed(2)),
    overallScore
  };
}

export function healthStatusLabel(score: number, hasCritical: boolean = false): string {
  if (hasCritical && score >= 75) return 'Needs Attention';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'Critical';
}

export function calculateHealthScore(
  totalPages: number,
  issues: any,
  weights: any = {
    orphans: 50,
    brokenLinks: 100,
    redirectChains: 20,
    duplicateClusters: 25,
    thinContent: 15,
    missingH1: 10,
    noindexMisuse: 20,
    canonicalConflicts: 10,
    lowInternalLinks: 10,
    excessiveLinks: 5,
    blockedByRobots: 100
  }
): { score: number; status: string; weightedPenalties: any } {
  const safePages = Math.max(totalPages, 1);
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const weightedPenalties = {
    orphans: clamp((issues.orphanPages / safePages) * weights.orphans, 0, weights.orphans),
    brokenLinks: clamp((issues.brokenInternalLinks / safePages) * weights.brokenLinks, 0, weights.brokenLinks),
    redirectChains: clamp((issues.redirectChains / safePages) * weights.redirectChains, 0, weights.redirectChains),
    duplicateClusters: clamp((issues.duplicateClusters / safePages) * weights.duplicateClusters, 0, weights.duplicateClusters),
    thinContent: clamp((issues.thinContent / safePages) * weights.thinContent, 0, weights.thinContent),
    missingH1: clamp((issues.missingH1 / safePages) * weights.missingH1, 0, weights.missingH1),
    noindexMisuse: clamp((issues.accidentalNoindex / safePages) * weights.noindexMisuse, 0, weights.noindexMisuse),
    canonicalConflicts: clamp((issues.canonicalConflicts / safePages) * weights.canonicalConflicts, 0, weights.canonicalConflicts),
    lowInternalLinks: clamp((issues.lowInternalLinkCount / safePages) * weights.lowInternalLinks, 0, weights.lowInternalLinks),
    excessiveLinks: clamp((issues.excessiveInternalLinkCount / safePages) * weights.excessiveLinks, 0, weights.excessiveLinks),
    blockedByRobots: clamp((issues.blockedByRobots / safePages) * weights.blockedByRobots, 0, weights.blockedByRobots)
  };

  const totalPenalty = Object.values(weightedPenalties).reduce((sum, value) => sum + value, 0);
  const score = Number(clamp(100 - totalPenalty, 0, 100).toFixed(1));

  const hasCritical = (
    issues.orphanPages > 0 ||
    issues.brokenInternalLinks > 0 ||
    issues.redirectChains > 0 ||
    issues.duplicateClusters > 0 ||
    issues.canonicalConflicts > 0 ||
    issues.accidentalNoindex > 0 ||
    issues.blockedByRobots > 0
  );

  return {
    score,
    status: healthStatusLabel(score, hasCritical),
    weightedPenalties
  };
}
