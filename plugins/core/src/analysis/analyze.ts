import { crawl } from '../crawler/crawl.js';
import { loadGraphFromSnapshot } from '../db/graphLoader.js';
import { normalizeUrl } from '../crawler/normalize.js';
import { calculateMetrics, Metrics } from '../graph/metrics.js';
import { Graph, ClusterInfo } from '../graph/graph.js';
import { analyzeContent, calculateThinContentScore } from './content.js';
import { analyzeH1, analyzeMetaDescription, analyzeTitle, H1Analysis, TextFieldAnalysis } from './seo.js';
import { analyzeImageAlts, ImageAltAnalysis } from './images.js';
import { analyzeLinks, LinkRatioAnalysis } from './links.js';
import { analyzeStructuredData, StructuredDataResult } from './structuredData.js';
import { aggregateSiteScore, scorePageSeo } from './scoring.js';
import { detectContentClusters } from '../graph/cluster.js';
import { getDb } from '../db/index.js';
import { SiteRepository } from '../db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../db/repositories/SnapshotRepository.js';
import { PageRepository } from '../db/repositories/PageRepository.js';
import { ANALYSIS_LIST_TEMPLATE, ANALYSIS_PAGE_TEMPLATE } from './templates.js';
import { EngineContext } from '../events.js';

export interface CrawlPage {
  url: string;
  status?: number;
  html?: string;
  depth?: number;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  crawlStatus?: string;
}

export interface AnalyzeOptions {
  live?: boolean;
  seo?: boolean;
  content?: boolean;
  accessibility?: boolean;
  rate?: number;
  proxyUrl?: string;
  userAgent?: string;
  maxRedirects?: number;
  debug?: boolean;
  clusterThreshold?: number;
  minClusterSize?: number;
  allPages?: boolean;
}

export interface PageAnalysis {
  url: string;
  status: number;
  title: TextFieldAnalysis;
  metaDescription: TextFieldAnalysis;
  h1: H1Analysis;
  content: ReturnType<typeof analyzeContent>;
  thinScore: number;
  images: ImageAltAnalysis;
  links: LinkRatioAnalysis;
  structuredData: StructuredDataResult;
  seoScore: number;
  meta: {
    canonical?: string;
    noindex?: boolean;
    nofollow?: boolean;
    crawlStatus?: string;
  }
}

export interface AnalysisResult {
  site_summary: {
    pages_analyzed: number;
    avg_seo_score: number;
    thin_pages: number;
    duplicate_titles: number;
    site_score: number;
  };
  site_scores: ReturnType<typeof aggregateSiteScore>;
  pages: PageAnalysis[];
  active_modules: {
    seo: boolean;
    content: boolean;
    accessibility: boolean;
  };
  clusters?: ClusterInfo[];
  snapshotId?: number;
  crawledAt?: string;
}

interface CrawlData {
  pages: Iterable<CrawlPage> | CrawlPage[];
  metrics: Metrics;
  graph: Graph;
  snapshotId: number;
  crawledAt?: string;
}

/**
 * Analyzes a site for SEO, content, and accessibility.
 * Supports live crawling or loading from a database snapshot.
 * Note: File-based data loading is not supported.
 *
 * @param url The root URL to analyze
 * @param options Analysis options
 * @param context Engine context for event emission
 */
export async function analyzeSite(url: string, options: AnalyzeOptions, context?: EngineContext): Promise<AnalysisResult> {
  const normalizedRoot = normalizeUrl(url, '', { stripQuery: false });
  if (!normalizedRoot) {
    throw new Error('Invalid URL for analysis');
  }

  let crawlData: CrawlData;
  let robots: any = null;

  // Always try to fetch robots.txt for the analysis session
  // to ensure we have the latest rules for visibility reporting.
  try {
    const robotsUrl = new URL('/robots.txt', normalizedRoot).toString();
    const robotsRes = await (new (await import('../crawler/fetcher.js')).Fetcher()).fetch(robotsUrl, { maxBytes: 500000 });
    const status = robotsRes.status;
    if (typeof status === 'number' && status >= 200 && status < 300) {
      const robotsParserModule = await import('robots-parser');
      const robotsParser = (robotsParserModule as any).default || robotsParserModule;
      robots = (robotsParser as any)(robotsUrl, robotsRes.body);
    }
  } catch {
    // Silence robots fetch errors, fallback to existing or none
  }
  if (options.live) {
    crawlData = await runLiveCrawl(normalizedRoot, options, context);
  } else {
    try {
      crawlData = await loadCrawlData(normalizedRoot);

      // Convert generator to array so it can be reused multiple times
      const allPages = Array.from(crawlData.pages);
      crawlData.pages = allPages;

      // Check if the requested URL actually exists in this snapshot
      const exists = allPages.some(p => p.url === normalizedRoot);
      if (!exists) {
        options.live = true; // Mark as live so the analysis knows to pick the first page if exact match fails
        if (context) {
          context.emit({ type: 'info', message: `URL ${normalizedRoot} not found in latest snapshot. Fetching live...` });
        }
        crawlData = await runLiveCrawl(normalizedRoot, options, context);
      }
    } catch (error: any) {
      const isNotFound = error.code === 'ENOENT' ||
        error.message.includes('Crawl data not found') ||
        error.message.includes('No completed snapshot found') ||
        error.message.includes('not found in database');
      if (isNotFound) {
        options.live = true; // Force live mode
        if (context) {
          context.emit({ type: 'info', message: 'No local crawl data found. Switching to live analysis mode...' });
        }
        crawlData = await runLiveCrawl(normalizedRoot, options, context);
      } else {
        throw error;
      }
    }
  }

  const snapshotId = crawlData.snapshotId;
  const crawledAt = crawlData.crawledAt;

  // Run clustering if requested or as default
  detectContentClusters(crawlData.graph, options.clusterThreshold, options.minClusterSize);

  const pages = analyzePages(normalizedRoot, crawlData.pages, robots);

  const activeModules = {
    seo: !!options.seo,
    content: !!options.content,
    accessibility: !!options.accessibility
  };

  const hasFilters = activeModules.seo || activeModules.content || activeModules.accessibility;

  const filteredPages = hasFilters
    ? pages.map((page) => filterPageModules(page, activeModules))
    : pages;

  // Filter to only the requested URL
  const targetPage = filteredPages.find(p => p.url === normalizedRoot);
  let resultPages: PageAnalysis[];

  if (options.allPages) {
    resultPages = filteredPages;
  } else {
    resultPages = targetPage ? [targetPage] : (options.live ? filteredPages.slice(0, 1) : []);
  }

  const duplicateTitles = pages.filter((page) => page.title.status === 'duplicate').length;
  const thinPages = pages.filter((page) => page.thinScore >= 70).length;
  const siteScores = aggregateSiteScore(crawlData.metrics, resultPages.length === 1 ? resultPages : pages);

  return {
    site_summary: {
      pages_analyzed: resultPages.length,
      avg_seo_score: siteScores.seoHealthScore,
      thin_pages: thinPages,
      duplicate_titles: duplicateTitles,
      site_score: siteScores.overallScore
    },
    site_scores: siteScores,
    pages: resultPages,
    active_modules: activeModules,
    clusters: crawlData.graph.contentClusters,
    snapshotId,
    crawledAt
  };
}

export function renderAnalysisHtml(result: AnalysisResult): string {
  if (result.pages.length === 1) {
    return renderSinglePageHtml(result.pages[0]);
  }
  const rows = result.pages
    .map((page) => `<tr><td>${escapeHtml(page.url)}</td><td>${page.seoScore}</td><td>${page.thinScore}</td><td>${page.title.status}</td><td>${page.metaDescription.status}</td></tr>`)
    .join('');

  return ANALYSIS_LIST_TEMPLATE
    .replace('{{PAGES_ANALYZED}}', result.site_summary.pages_analyzed.toString())
    .replace('{{AVG_SEO_SCORE}}', result.site_summary.avg_seo_score.toString())
    .replace('{{ROWS}}', rows);
}

function renderSinglePageHtml(page: PageAnalysis): string {
  const structuredDataStatus = page.structuredData.present
    ? (page.structuredData.valid ? '<span class="status-ok">Valid</span>' : '<span class="status-critical">Invalid JSON</span>')
    : 'Not detected';

  const structuredDataTypesRow = page.structuredData.present ? `
      <tr>
          <th>Types Found</th>
          <td>${page.structuredData.types.map(t => `<code>${t}</code>`).join(', ')}</td>
      </tr>
      ` : '';

  return ANALYSIS_PAGE_TEMPLATE
    .replaceAll('{{URL}}', escapeHtml(page.url))
    .replace('{{SEO_SCORE}}', page.seoScore.toString())
    .replace('{{THIN_SCORE}}', page.thinScore.toString())
    .replace('{{HTTP_STATUS}}', page.status === 0 ? 'Pending/Limit' : page.status.toString())
    .replace('{{TITLE_VALUE}}', escapeHtml(page.title.value || '(missing)'))
    .replace('{{TITLE_LENGTH}}', page.title.length.toString())
    .replaceAll('{{TITLE_STATUS}}', page.title.status)
    .replace('{{META_DESCRIPTION_VALUE}}', escapeHtml(page.metaDescription.value || '(missing)'))
    .replace('{{META_DESCRIPTION_LENGTH}}', page.metaDescription.length.toString())
    .replaceAll('{{META_DESCRIPTION_STATUS}}', page.metaDescription.status)
    .replace('{{CANONICAL}}', page.meta.canonical ? escapeHtml(page.meta.canonical) : '<em>(none)</em>')
    .replace('{{ROBOTS_INDEX}}', (!page.meta.noindex).toString())
    .replace('{{ROBOTS_FOLLOW}}', (!page.meta.nofollow).toString())
    .replaceAll('{{H1_STATUS}}', page.h1.status)
    .replace('{{H1_COUNT}}', page.h1.count.toString())
    .replace('{{H1_MATCHES_TITLE}}', page.h1.matchesTitle ? ' | Matches Title' : '')
    .replace('{{WORD_COUNT}}', page.content.wordCount.toString())
    .replace('{{UNIQUE_SENTENCES}}', page.content.uniqueSentenceCount.toString())
    .replace('{{TEXT_HTML_RATIO}}', (page.content.textHtmlRatio * 100).toFixed(2))
    .replace('{{INTERNAL_LINKS}}', page.links.internalLinks.toString())
    .replace('{{EXTERNAL_LINKS}}', page.links.externalLinks.toString())
    .replace('{{EXTERNAL_RATIO}}', (page.links.externalRatio * 100).toFixed(1))
    .replace('{{TOTAL_IMAGES}}', page.images.totalImages.toString())
    .replace('{{MISSING_ALT}}', page.images.missingAlt.toString())
    .replace('{{STRUCTURED_DATA_STATUS}}', structuredDataStatus)
    .replace('{{STRUCTURED_DATA_TYPES_ROW}}', structuredDataTypesRow);
}

export function renderAnalysisMarkdown(result: AnalysisResult): string {
  const summary = [
    '# Crawlith SEO Analysis Report',
    '',
    '## 📊 Summary',
    `- Pages Analyzed: ${result.site_summary.pages_analyzed}`,
    `- Overall Site Score: ${result.site_summary.site_score.toFixed(1)}`,
    `- Avg SEO Score: ${result.site_summary.avg_seo_score.toFixed(1)}`,
    `- Thin Pages Found: ${result.site_summary.thin_pages}`,
    `- Duplicate Titles: ${result.site_summary.duplicate_titles}`,
    '',
    '## 📄 Page Details',
    '',
    '| URL | SEO Score | Thin Score | Title Status | Meta Status |',
    '| :--- | :--- | :--- | :--- | :--- |',
  ];

  result.pages.forEach((page) => {
    summary.push(`| ${page.url} | ${page.seoScore} | ${page.thinScore} | ${page.title.status} | ${page.metaDescription.status} |`);
  });

  return summary.join('\n');
}

export function renderAnalysisCsv(result: AnalysisResult): string {
  const headers = ['URL', 'SEO Score', 'Thin Score', 'HTTP Status', 'Title', 'Title Length', 'Meta Description', 'Desc Length', 'Word Count', 'Internal Links', 'External Links'];
  const rows = result.pages.map((p) => {
    const statusStr = p.status === 0 ? 'Pending/Limit' : p.status;
    return [
      p.url,
      p.seoScore,
      p.thinScore,
      statusStr,
      `"${(p.title.value || '').replace(/"/g, '""')}"`,
      p.title.length,
      `"${(p.metaDescription.value || '').replace(/"/g, '""')}"`,
      p.metaDescription.length,
      p.content.wordCount,
      p.links.internalLinks,
      p.links.externalLinks
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function analyzePages(rootUrl: string, pages: Iterable<CrawlPage> | CrawlPage[], robots?: any): PageAnalysis[] {
  const titleCounts = new Map<string, number>();
  const metaCounts = new Map<string, number>();
  const sentenceCountFrequency = new Map<number, number>();

  const results: PageAnalysis[] = [];

  for (const page of pages) {
    const html = page.html || '';

    // 0. Update crawl status based on current robots rules
    let crawlStatus = page.crawlStatus;
    if (robots) {
      const isBlocked = !robots.isAllowed(page.url, 'crawlith') ||
        (!page.url.endsWith('/') && !robots.isAllowed(page.url + '/', 'crawlith'));
      if (isBlocked) {
        crawlStatus = 'blocked_by_robots';
      }
    }

    // 1. Analyze Individual Components
    const title = analyzeTitle(html);
    const metaDescription = analyzeMetaDescription(html);
    const h1 = analyzeH1(html, title.value);
    const content = analyzeContent(html);
    const images = analyzeImageAlts(html);
    const links = analyzeLinks(html, page.url, rootUrl);
    const structuredData = analyzeStructuredData(html);

    // 2. Accumulate Frequencies for Duplicates
    if (title.value) {
      const key = (title.value || '').trim().toLowerCase();
      titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
    }
    if (metaDescription.value) {
      const key = (metaDescription.value || '').trim().toLowerCase();
      metaCounts.set(key, (metaCounts.get(key) || 0) + 1);
    }
    sentenceCountFrequency.set(content.uniqueSentenceCount, (sentenceCountFrequency.get(content.uniqueSentenceCount) || 0) + 1);

    // 3. Store Preliminary Result
    results.push({
      url: page.url,
      status: page.status || 0,
      title,
      metaDescription,
      h1,
      content,
      thinScore: 0, // Calculated in pass 2
      images,
      links,
      structuredData,
      seoScore: 0, // Calculated in pass 2
      meta: {
        canonical: page.canonical,
        noindex: page.noindex,
        nofollow: page.nofollow,
        crawlStatus
      }
    });
  }

  // 4. Finalize Statuses and Scores (Pass 2)
  for (const analysis of results) {
    // Check Title Duplicates
    if (analysis.title.value) {
      const key = (analysis.title.value || '').trim().toLowerCase();
      if ((titleCounts.get(key) || 0) > 1) {
        analysis.title.status = 'duplicate';
      }
    }

    // Check Meta Duplicates
    if (analysis.metaDescription.value) {
      const key = (analysis.metaDescription.value || '').trim().toLowerCase();
      if ((metaCounts.get(key) || 0) > 1) {
        analysis.metaDescription.status = 'duplicate';
      }
    }

    // Check Content Duplication
    const duplicationScore = (sentenceCountFrequency.get(analysis.content.uniqueSentenceCount) || 0) > 1 ? 100 : 0;
    analysis.thinScore = calculateThinContentScore(analysis.content, duplicationScore);

    // Calculate Final SEO Score
    analysis.seoScore = scorePageSeo(analysis);
  }

  return results;
}

function filterPageModules(
  page: PageAnalysis,
  modules: { seo: boolean; content: boolean; accessibility: boolean }
): PageAnalysis {
  const keepSeo = modules.seo;
  const keepContent = modules.content;
  const keepAccessibility = modules.accessibility;

  return {
    ...page,
    title: keepSeo ? page.title : { value: null, length: 0, status: 'missing' },
    metaDescription: keepSeo ? page.metaDescription : { value: null, length: 0, status: 'missing' },
    h1: (keepSeo || keepContent) ? page.h1 : { count: 0, status: 'critical', matchesTitle: false },
    links: keepSeo ? page.links : { internalLinks: 0, externalLinks: 0, nofollowCount: 0, externalRatio: 0 },
    structuredData: keepSeo ? page.structuredData : { present: false, valid: false, types: [] },
    content: keepContent ? page.content : { wordCount: 0, textHtmlRatio: 0, uniqueSentenceCount: 0 },
    thinScore: keepContent ? page.thinScore : 0,
    images: keepAccessibility ? page.images : { totalImages: 0, missingAlt: 0, emptyAlt: 0 }
  };
}

async function loadCrawlData(rootUrl: string): Promise<CrawlData> {
  const db = getDb();
  const siteRepo = new SiteRepository(db);
  const snapshotRepo = new SnapshotRepository(db);
  const pageRepo = new PageRepository(db);

  const urlObj = new URL(rootUrl);
  const domain = urlObj.hostname.replace('www.', '');
  const site = siteRepo.firstOrCreateSite(domain);

  let snapshot;
  const page = pageRepo.getPage(site.id, rootUrl);
  if (page && page.last_seen_snapshot_id) {
    snapshot = snapshotRepo.getSnapshot(page.last_seen_snapshot_id);
  }

  if (!snapshot) {
    snapshot = snapshotRepo.getLatestSnapshot(site.id);
  }

  if (!snapshot) {
    throw new Error(`No crawl data found for ${rootUrl} in database.`);
  }

  const graph = loadGraphFromSnapshot(snapshot.id);
  const metrics = calculateMetrics(graph, 5);

  // Use iterator to save memory
  const dbPagesIterator = pageRepo.getPagesIteratorBySnapshot(snapshot.id);

  // We need to map the DB pages to CrawlPage format lazily
  const pagesGenerator = function* () {
    for (const p of dbPagesIterator) {
      yield {
        url: p.normalized_url,
        status: p.http_status || 0,
        html: p.html || '',
        depth: p.depth || 0,
        canonical: p.canonical_url || undefined,
        noindex: !!p.noindex,
        nofollow: !!p.nofollow,
        crawlStatus: graph.nodes.get(p.normalized_url)?.crawlStatus
      } as CrawlPage;
    }
  };

  return { pages: pagesGenerator(), metrics, graph, snapshotId: snapshot.id, crawledAt: snapshot.created_at };
}


async function runLiveCrawl(url: string, options: AnalyzeOptions, context?: EngineContext): Promise<CrawlData> {
  const snapshotId = await crawl(url, {
    limit: 1, // Always limit to 1 for single page live analysis
    depth: 0,
    rate: options.rate,
    proxyUrl: options.proxyUrl,
    userAgent: options.userAgent,
    maxRedirects: options.maxRedirects,
    debug: options.debug,
    snapshotType: 'partial'
  }, context) as number;
  const graph = loadGraphFromSnapshot(snapshotId);
  const pages = graph.getNodes().map((node) => ({
    url: node.url,
    status: node.status,
    html: node.html || '', // Include HTML
    depth: node.depth,
    crawlStatus: node.crawlStatus
  }));
  return {
    pages,
    metrics: calculateMetrics(graph, 1),
    graph,
    snapshotId
  };
}
