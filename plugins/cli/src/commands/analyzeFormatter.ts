import chalk from 'chalk';

export interface AnalyzeInsightPage {
  url: string;
  status: number;
  seoScore: number;
  thinScore: number;
  title: { value: string | null; length: number; status: string };
  metaDescription: { value: string | null; length: number; status: string };
  h1: { count: number; status: string; matchesTitle: boolean };
  content: { wordCount: number; textHtmlRatio: number; uniqueSentenceCount: number };
  images: { totalImages: number; missingAlt: number; emptyAlt: number };
  links: { internalLinks: number; externalLinks: number; nofollowCount: number; externalRatio: number };
  structuredData: { present: boolean; valid: boolean; types: string[] };
  meta: { canonical?: string; noindex?: boolean; nofollow?: boolean; crawlStatus?: string };
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
  active_modules?: {
    seo: boolean;
    content: boolean;
    accessibility: boolean;
  };
  snapshotId?: number;
  crawledAt?: string;
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
    blockedByRobots: number;
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
  snapshotId?: number;
  crawledAt?: string;
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

  const blockedByRobots = pages.filter((p) => p.meta.crawlStatus === 'blocked_by_robots').length;

  const critical = {
    missingTitles: pages.filter((p) => p.title.status === 'missing').length,
    missingMetaDescriptions: pages.filter((p) => p.metaDescription.status === 'missing').length,
    accidentalNoindex: pages.filter((p) => p.meta.noindex && p.status >= 200 && p.status < 300).length,
    severeThinContent: pages.filter((p) => p.thinScore >= THIN_CRITICAL).length,
    blockedByRobots
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
    topPages,
    snapshotId: result.snapshotId,
    crawledAt: result.crawledAt
  };
}

export function hasAnalyzeCriticalIssues(report: AnalyzeInsightReport): boolean {
  return Object.values(report.critical).some((count) => count > 0);
}
export function renderAnalyzeInsightOutput(report: AnalyzeInsightReport, result?: AnalyzeInsightResult): string {

  const lines: string[] = [];
  const isSinglePage = report.pages === 1;

  // Header
  lines.push(`CRAWLITH — Analyze`);
  lines.push('');

  if (report.snapshotId) {
    const crawlDate = report.crawledAt
      ? new Date(report.crawledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    lines.push(chalk.dim(`Snapshot #${report.snapshotId}`) + (crawlDate ? chalk.dim(` · Crawled ${crawlDate}`) : ''));
    lines.push('');
  }

  if (isSinglePage && result && result.pages.length > 0) {
    const page = result.pages[0];
    const active = result.active_modules || { seo: false, content: false, accessibility: false };
    const hasFilters = active.seo || active.content || active.accessibility;

    lines.push(`${chalk.dim('URL:')} ${chalk.cyan(page.url)}`);
    lines.push('');

    lines.push(chalk.bold('Checks'));

    // 1. Robots
    const isBlocked = page.meta.crawlStatus === 'blocked_by_robots';
    lines.push(`  ${isBlocked ? chalk.red('•') : chalk.green('✓')} [Robots]       ${isBlocked ? chalk.red('Blocked by robots.txt') : 'Access allowed'}`);

    // 2. Title
    if (!hasFilters || active.seo) {
      const titleStatus = page.title.status;
      const titleColor = titleStatus === 'ok' ? chalk.green : (titleStatus === 'missing' ? chalk.red : chalk.yellow);
      const titleIcon = titleStatus === 'ok' ? chalk.green('✓') : titleColor('•');
      const titleLabel = titleStatus === 'ok' ? 'Title OK' : titleStatus === 'missing' ? 'Missing title tag' : `Title is ${titleStatus.replace('_', ' ')}`;
      lines.push(`  ${titleIcon} [Title]        ${titleLabel} ${chalk.dim(`(${page.title.length} chars)`)}`);
    }

    // 3. Meta
    if (!hasFilters || active.seo) {
      const metaStatus = page.metaDescription.status;
      const metaColor = metaStatus === 'ok' ? chalk.green : (metaStatus === 'missing' ? chalk.red : chalk.yellow);
      const metaIcon = metaStatus === 'ok' ? chalk.green('✓') : metaColor('•');
      const metaLabel = metaStatus === 'ok' ? 'Meta found' : metaStatus === 'missing' ? 'Missing meta description' : `Meta is ${metaStatus.replace('_', ' ')}`;
      lines.push(`  ${metaIcon} [Description]  ${metaLabel} ${chalk.dim(`(${page.metaDescription.length} chars)`)}`);
    }

    // 4. H1
    if (!hasFilters || active.seo || active.content) {
      const h1Status = page.h1.count === 1 ? 'ok' : (page.h1.count === 0 ? 'missing' : 'warning');
      const h1Icon = h1Status === 'ok' ? chalk.green('✓') : (h1Status === 'missing' ? chalk.red('•') : chalk.yellow('•'));
      const h1Label = page.h1.count === 0 ? 'Missing H1 tag' : `${page.h1.count} tag${page.h1.count > 1 ? 's' : ''} found`;
      lines.push(`  ${h1Icon} [H1 Header]    ${h1Label}${page.h1.matchesTitle ? chalk.dim(' (Matches Title)') : ''}`);
    }

    // 5. Content
    if (!hasFilters || active.content) {
      const contentIcon = page.content.wordCount >= 300 ? chalk.green('✓') : chalk.yellow('•');
      const ratio = (page.content.textHtmlRatio * 100).toFixed(1);
      lines.push(`  ${contentIcon} [Word Count]   ${page.content.wordCount === 0 ? chalk.red('No content found') : `${page.content.wordCount} words ${chalk.dim(`(${ratio}% Text/HTML)`)}`}`);

      const thinIcon = page.thinScore < 70 ? chalk.green('✓') : chalk.yellow('•');
      lines.push(`  ${thinIcon} [Thin Content] ${page.thinScore < 70 ? 'Good content density' : 'Potential thin content'}`);
    }

    // 6. Link info
    if (!hasFilters || active.seo) {
      const totalLinks = page.links.internalLinks + page.links.externalLinks;
      const linksIcon = totalLinks > 0 ? chalk.green('✓') : chalk.yellow('•');
      lines.push(`  ${linksIcon} [Links]        ${page.links.internalLinks} internal / ${page.links.externalLinks} external ${chalk.dim(`(${totalLinks} nodes)`)}`);
    }

    // 7. Images
    if (!hasFilters || active.accessibility) {
      const imgIcon = (page.images.totalImages > 0 && page.images.missingAlt === 0) ? chalk.green('✓') : (page.images.totalImages === 0 ? chalk.dim('✓') : chalk.yellow('•'));
      const imgStatusText = page.images.totalImages === 0 ? 'No images' : (page.images.missingAlt === 0 ? 'All images have alt text' : `${page.images.missingAlt} missing alt text`);
      lines.push(`  ${imgIcon} [Images]       ${page.images.totalImages} images ${chalk.dim(`(${imgStatusText})`)}`);
    }

    // 8. Structured Data
    if (!hasFilters || active.seo) {
      if (page.structuredData.present) {
        const sdIcon = page.structuredData.valid ? chalk.green('✓') : chalk.red('•');
        const types = page.structuredData.types.length > 0 ? chalk.dim(`(${page.structuredData.types.join(', ')})`) : '';
        lines.push(`  ${sdIcon} [Structured]   ${page.structuredData.valid ? 'Valid JSON-LD' : 'Invalid data found'} ${types}`);
      }
    }

    lines.push('');
    const scoreColor = report.score >= 75 ? chalk.green : (report.score >= 50 ? chalk.yellow : chalk.red);
    lines.push(`${chalk.bold('Health')}      ${scoreColor(`${report.score}/100`)}   ${chalk.bold(report.status)}`);
  } else {
    // Original multi-page report format
    lines.push(`${report.pages} pages scanned`);
    lines.push('');
    lines.push(`Health      ${report.score}/100   ${report.status}`);
    lines.push('');

    const criticalItems: string[] = [];
    if (report.critical.missingTitles > 0) criticalItems.push(`${report.critical.missingTitles} pages missing title`);
    if (report.critical.missingMetaDescriptions > 0) criticalItems.push(`${report.critical.missingMetaDescriptions} pages missing meta description`);
    if (report.critical.accidentalNoindex > 0) criticalItems.push(`${report.critical.accidentalNoindex} pages accidentally noindexed`);
    if (report.critical.severeThinContent > 0) criticalItems.push(`${report.critical.severeThinContent} pages with severe thin content`);
    if (report.critical.blockedByRobots > 0) criticalItems.push(`${report.critical.blockedByRobots} pages blocked by robots.txt`);

    if (criticalItems.length > 0) {
      lines.push(`Critical`);
      for (const c of criticalItems) lines.push(`  • ${c}`);
      lines.push('');
    }

    const warningItems: string[] = [];
    if (report.warnings.missingH1 > 0) warningItems.push(`${report.warnings.missingH1} pages missing H1`);
    if (report.warnings.lowWordCount > 0) warningItems.push(`${report.warnings.lowWordCount} pages under ${WORD_COUNT_WARNING} words`);
    if (report.warnings.thinContent > 0) warningItems.push(`${report.warnings.thinContent} pages with thin content`);
    if (report.warnings.lowInternalLinks > 0) warningItems.push(`${report.warnings.lowInternalLinks} pages with low internal links`);
    if (report.warnings.highExternalLinkRatio > 0) warningItems.push(`${report.warnings.highExternalLinkRatio} pages with high external ratio`);
    if (report.warnings.missingImageAlt > 0) warningItems.push(`${report.warnings.missingImageAlt} pages missing image alt`);

    if (warningItems.length > 0) {
      lines.push(`Warnings`);
      for (const w of warningItems) lines.push(`  • ${w}`);
      lines.push('');
    }

    lines.push(`Overview`);
    lines.push(`  Avg SEO Score     ${report.summary.avgSeoScore}`);
    lines.push(`  Thin Pages        ${report.summary.thinPages}`);
    lines.push('');

    if (report.topPages.length > 0) {
      lines.push(`Top Pages`);
      for (const page of report.topPages.slice(0, 10)) {
        lines.push(`  ${page.url}   ${page.score.toFixed(1)}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}