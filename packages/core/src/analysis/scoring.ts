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
  let h1 = page.h1.status === 'ok' ? 100 : page.h1.status === 'warning' ? 60 : 10;
  if (page.headingScore !== undefined && page.headingScore !== null) {
    h1 = page.headingScore;
  }
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

