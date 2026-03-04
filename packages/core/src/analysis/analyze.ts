import { load } from 'cheerio';
import { crawl } from '../crawler/crawl.js';
import { UrlResolver } from '../crawler/resolver.js';
import { Fetcher } from '../crawler/fetcher.js';
import { loadGraphFromSnapshot } from '../db/graphLoader.js';
import { normalizeUrl, UrlUtil } from '../crawler/normalize.js';
import { calculateMetrics, Metrics } from '../graph/metrics.js';
import { Graph } from '../graph/graph.js';
import { analyzeContent, calculateThinContentScore } from './content.js';
import { analyzeH1, analyzeMetaDescription, analyzeTitle, H1Analysis, TextFieldAnalysis } from './seo.js';
import { analyzeImageAlts, ImageAltAnalysis } from './images.js';
import { analyzeLinks, LinkRatioAnalysis } from './links.js';
import { analyzeStructuredData, StructuredDataResult } from './structuredData.js';
import { aggregateSiteScore, scorePageSeo } from './scoring.js';
import { ClusteringService } from './clustering.js';
import { DuplicateService } from './duplicate.js';
import { Soft404Service } from './soft404.js';

import { getDb } from '../db/index.js';
import { SiteRepository } from '../db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../db/repositories/SnapshotRepository.js';
import { PageRepository } from '../db/repositories/PageRepository.js';
import { MetricsRepository } from '../db/repositories/MetricsRepository.js';
import { ANALYSIS_LIST_TEMPLATE, ANALYSIS_PAGE_TEMPLATE } from './templates.js';
import { EngineContext } from '../events.js';
import { DEFAULTS } from '../constants.js';

import { PageRankService } from '../graph/pagerank.js';
import { HITSService } from '../graph/hits.js';
import { HeadingHealthService } from './heading.js';
import { annotateOrphans } from './orphan.js';
import { HealthService } from '../scoring/health.js';

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
  snapshotId?: number;
  seo?: boolean;
  content?: boolean;
  accessibility?: boolean;
  rate?: number;
  proxyUrl?: string;
  userAgent?: string;
  maxRedirects?: number;
  maxBytes?: number;
  debug?: boolean;
  heading?: boolean;
  clustering?: boolean;
  clusterThreshold?: number;
  minClusterSize?: number;
  allPages?: boolean;
  sitemap?: string | boolean;
  health?: boolean;
  failOnCritical?: boolean;
  scoreBreakdown?: boolean;
  computeHits?: boolean;
  computePagerank?: boolean;
  orphans?: boolean;
  orphanSeverity?: 'low' | 'medium' | 'high';
  includeSoftOrphans?: boolean;
  minInbound?: number;
  plugins?: any[]; // CrawlithPlugin[]
  pluginContext?: any; // PluginContext
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
    canonicalConflict?: boolean;
  };
  soft404?: { score: number; reason: string };
  headingScore?: number;
  plugins?: Record<string, any>;
}

export interface AnalysisResult {
  site_summary: {
    pages_analyzed: number;
    avg_seo_score: number;
    thin_pages: number;
    duplicate_titles: number;
    site_score: number;
    site_score_breakdown?: any;
  };
  site_scores: ReturnType<typeof aggregateSiteScore>;
  pages: PageAnalysis[];
  active_modules: {
    seo: boolean;
    content: boolean;
    accessibility: boolean;
  };

  snapshotId?: number;
  crawledAt?: string;
  clusters?: any[];
  duplicates?: any[];
  plugins?: Record<string, any>;
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
 */
export async function analyzeSite(url: string, options: AnalyzeOptions, context?: EngineContext): Promise<AnalysisResult> {
  // 1. Parse siteOrigin (e.g. https://example.com) and targetPath (e.g. /stats) from the URL.
  //    We resolve the *origin* — not the full page URL — so rootOrigin is always just the
  //    scheme+host and normalizedPath is always the pathname.
  let parsedUrl: URL | null = null;
  try { parsedUrl = new URL(url); } catch { /* bare domain fallback below */ }

  const inputOrigin = parsedUrl ? `${parsedUrl.protocol}//${parsedUrl.host}` : url;
  const inputPath = parsedUrl?.pathname || '/';

  let rootOrigin = inputOrigin;
  if (options.live !== false) {
    const resolver = new UrlResolver();
    const fetcher = new Fetcher({ rate: options.rate, proxyUrl: options.proxyUrl, userAgent: options.userAgent });
    try {
      const resolved = await resolver.resolve(inputOrigin, fetcher);
      rootOrigin = resolved.url;
    } catch {
      // Fallback to basic normalization if resolution fails
    }
  }

  // Normalize the resolved origin
  const normalizedAbs = normalizeUrl(rootOrigin, '', { stripQuery: false });
  if (!normalizedAbs) {
    throw new Error('Invalid URL for analysis');
  }

  // normalizedPath: use the input pathname (e.g. '/stats'), falling back to '/' for root
  const normalizedPath = inputPath && inputPath !== '/' ? inputPath : UrlUtil.toPath(normalizedAbs, rootOrigin);

  const start = Date.now();
  let crawlData: CrawlData;
  let robots: any = null;

  // 1. Robots fetch (live-mode only to keep snapshot analysis deterministic and fast)
  if (options.live) {
    try {
      const robotsUrl = new URL('/robots.txt', rootOrigin).toString();
      const { Fetcher } = await import('../crawler/fetcher.js');
      const fetcher = new Fetcher({
        rate: DEFAULTS.RATE_LIMIT,
        proxyUrl: options.proxyUrl,
        userAgent: options.userAgent
      });
      const robotsRes = await fetcher.fetch(robotsUrl, { maxBytes: 500000 });
      if (typeof robotsRes.status === 'number' && robotsRes.status >= 200 && robotsRes.status < 300) {
        const robotsParserModule = await import('robots-parser');
        const robotsParser = (robotsParserModule as any).default || robotsParserModule;
        robots = (robotsParser as any)(robotsUrl, robotsRes.body);
        if (context) context.emit({ type: 'info', message: `[analyze] Robots fetch took ${Date.now() - start}ms` });
      }
    } catch {
      // Fallback
    }
  }

  // Data Acquisition
  if (options.live) {
    const fullUrl = parsedUrl ? parsedUrl.toString() : (url.startsWith('http') ? url : `https://${url}`);
    const normalizedFull = normalizeUrl(fullUrl, rootOrigin, { stripQuery: false }) || fullUrl;

    const crawlStart = Date.now();
    crawlData = await runLiveCrawl(normalizedFull, rootOrigin, options, context, robots);
    if (context) context.emit({ type: 'info', message: `[analyze] runLiveCrawl took ${Date.now() - crawlStart}ms` });
  } else {
    try {
      const loadStart = Date.now();
      crawlData = await loadCrawlData(normalizedAbs, options.snapshotId);
      if (context) context.emit({ type: 'debug', message: `[analyze] loadCrawlData took ${Date.now() - loadStart}ms` });

      const allPages = Array.from(crawlData.pages);
      crawlData.pages = allPages;

      const exists = allPages.some(p => p.url === normalizedPath);
      if (!exists) {
        if (context) context.emit({ type: 'info', message: `URL ${normalizedAbs} not found. Fetching live...` });
        crawlData = await runLiveCrawl(normalizedAbs, rootOrigin, options, context, robots);
      }
    } catch (_error: any) {
      if (context) context.emit({ type: 'info', message: 'No local crawl data found. Switching to live...' });
      crawlData = await runLiveCrawl(normalizedAbs, rootOrigin, options, context, robots);
    }
  }

  const snapshotId = crawlData.snapshotId;
  const crawledAt = crawlData.crawledAt;



  const pagesStart = Date.now();
  const pages = analyzePages(normalizedPath, rootOrigin, crawlData.pages, robots, options);
  if (context) context.emit({ type: 'debug', message: `[analyze] analyzePages took ${Date.now() - pagesStart}ms` });

  // Sync basic page analysis results back to graph nodes for persistence
  for (const pageAnalysis of pages) {
    const node = crawlData.graph.nodes.get(pageAnalysis.url);
    if (node) {
      node.soft404Score = pageAnalysis.soft404?.score;
      node.wordCount = pageAnalysis.content.wordCount;
      node.externalLinkRatio = pageAnalysis.links.externalRatio;
      node.thinContentScore = pageAnalysis.thinScore;
      node.title = pageAnalysis.title.value || undefined;
    }
  }

  const activeModules = {
    seo: !!options.seo,
    content: !!options.content,
    accessibility: !!options.accessibility
  };

  const hasFilters = activeModules.seo || activeModules.content || activeModules.accessibility;
  const filteredPages = hasFilters ? pages.map((page) => filterPageModules(page, activeModules)) : pages;

  const targetPage = filteredPages.find(p => p.url === normalizedPath || p.url === normalizedAbs);
  let resultPages: PageAnalysis[];

  if (options.allPages) {
    resultPages = filteredPages;
  } else {
    resultPages = targetPage ? [targetPage] : (options.live ? filteredPages.slice(0, 1) : []);
  }


  let clusters: any[] = [];
  let duplicates: any[] = [];
  let prResults = new Map<string, any>();
  let hitsResults = new Map<string, any>();
  let headingPayloads: Record<string, any> = {};

  if (options.clustering) {
    const clustering = new ClusteringService();
    clusters = clustering.detectContentClusters(crawlData.graph, options.clusterThreshold, options.minClusterSize);
  }

  if (options.allPages) {
    const duplication = new DuplicateService();
    duplicates = duplication.detectDuplicates(crawlData.graph, { collapse: false });
  }

  if (options.computePagerank) {
    const prService = new PageRankService();
    prResults = prService.evaluate(crawlData.graph);
  }

  if (options.computeHits) {
    const hitsService = new HITSService();
    hitsResults = hitsService.evaluate(crawlData.graph);
  }

  if (options.heading) {
    const headingService = new HeadingHealthService();
    const { payloadsByUrl } = headingService.evaluateNodes(crawlData.graph.getNodes());
    headingPayloads = payloadsByUrl;
  }

  if (options.orphans) {
    const edges = crawlData.graph.getEdges();
    annotateOrphans(crawlData.graph.getNodes(), edges, {
      enabled: true,
      severityEnabled: !!options.orphanSeverity,
      includeSoftOrphans: !!options.includeSoftOrphans,
      minInbound: options.minInbound || 2,
      rootUrl: normalizedAbs
    });
  }

  // Run HealthService when --health is enabled
  let healthBreakdown: ReturnType<HealthService['calculateHealthScore']> | undefined;
  if (options.health) {
    const healthService = new HealthService();
    const issues = healthService.collectCrawlIssues(crawlData.graph, crawlData.metrics, rootOrigin);
    healthBreakdown = healthService.calculateHealthScore(crawlData.graph.nodes.size, issues);
  }

  // Update nodes in graph with results
  for (const node of crawlData.graph.getNodes()) {
    const pr = prResults.get(node.url);
    if (pr) node.pagerankScore = pr.score;

    const hits = hitsResults.get(node.url);
    if (hits) {
      node.hubScore = hits.hub_score;
      node.authScore = hits.authority_score;
      node.linkRole = hits.link_role;
    }

    const heading = headingPayloads[node.url];
    if (heading) {
      node.headingScore = heading.score;
      node.headingData = JSON.stringify(heading);
    }
  }

  // Synchronize graph-level final scores back to PageAnalysis models
  for (const page of pages) {
    const node = crawlData.graph.nodes.get(page.url);
    if (node) {
      if (node.headingScore !== undefined) page.headingScore = node.headingScore;
      page.seoScore = scorePageSeo(page);
    }
  }

  const duplicateTitles = pages.filter((page) => page.title.status === 'duplicate').length;
  const thinPages = pages.filter((page) => page.thinScore >= 70).length;
  const siteScores = aggregateSiteScore(crawlData.metrics, resultPages.length === 1 ? resultPages : pages);
  if (context) context.emit({ type: 'debug', message: `[analyze] Total analysis completed in ${Date.now() - start}ms` });



  // Persist to Database
  const db = getDb();
  const metricsRepo = new MetricsRepository(db);
  const pageRepo = new PageRepository(db);

  // Efficiently map URLs to IDs for this snapshot
  const pagesIdentity = pageRepo.getPagesIdentityBySnapshot(snapshotId);
  const urlToIdMap = new Map(pagesIdentity.map(p => [p.normalized_url, p.id]));

  const metricsToSave = crawlData.graph.getNodes().map(node => {
    const pageId = urlToIdMap.get(node.url);
    if (!pageId) return null;

    return {
      snapshot_id: snapshotId,
      page_id: pageId,
      crawl_status: node.crawlStatus || null,
      word_count: node.wordCount || null,
      thin_content_score: node.thinContentScore || null,
      external_link_ratio: node.externalLinkRatio || null,
      pagerank_score: node.pagerankScore || null,
      hub_score: node.hubScore || null,
      auth_score: node.authScore || null,
      link_role: node.linkRole || null,
      duplicate_cluster_id: (node as any).duplicateClusterId || null,
      duplicate_type: (node as any).duplicateType || null,
      cluster_id: (node as any).clusterId || null,
      soft404_score: node.soft404Score || null,
      heading_score: node.headingScore || null,
      orphan_score: node.orphanScore || null,
      orphan_type: node.orphanType || null,
      impact_level: node.impactLevel || null,
      heading_data: node.headingData || null,
      is_cluster_primary: (node as any).isClusterPrimary ? 1 : 0
    };
  }).filter(m => m !== null);

  // Persist health score to snapshot if computed
  if (healthBreakdown && snapshotId) {
    const db2 = getDb();
    const snapshotRepo = new SnapshotRepository(db2);
    snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', {
      health_score: healthBreakdown.score
    });
  }

  metricsRepo.insertMany(metricsToSave as any);

  const result: AnalysisResult = {
    site_summary: {
      pages_analyzed: resultPages.length,
      avg_seo_score: siteScores.seoHealthScore,
      thin_pages: thinPages,
      duplicate_titles: duplicateTitles,
      site_score: siteScores.overallScore,
      site_score_breakdown: (siteScores as any).breakdown
    },
    site_scores: siteScores,
    pages: resultPages,
    active_modules: activeModules,

    snapshotId,
    crawledAt,
    clusters,
    duplicates
  };

  return result;
}


export function analyzePages(targetPath: string, rootOrigin: string, pages: Iterable<CrawlPage> | CrawlPage[], robots?: any, options: AnalyzeOptions = {}): PageAnalysis[] {
  const titleCounts = new Map<string, number>();
  const metaCounts = new Map<string, number>();
  const sentenceCountFrequency = new Map<number, number>();

  const results: PageAnalysis[] = [];

  for (const page of pages) {
    // page.url is a root-relative path (e.g. '/about') — compare to targetPath
    const isTarget = page.url === targetPath;

    // In single-page mode, if it's not the target, we skip it entirely for speed.
    if (!options.allPages && !isTarget) continue;

    const html = page.html || '';
    const $ = load(html || '<html></html>');

    // Reconstruct absolute URL from stored path for robots & link resolution
    const pageAbsUrl = UrlUtil.toAbsolute(page.url, rootOrigin);

    let crawlStatus = page.crawlStatus;
    if (robots) {
      const isBlocked = !robots.isAllowed(pageAbsUrl, 'crawlith') ||
        (!pageAbsUrl.endsWith('/') && !robots.isAllowed(pageAbsUrl + '/', 'crawlith'));
      if (isBlocked) crawlStatus = 'blocked_by_robots';
    }

    // Shared DOM Analysis
    const title = analyzeTitle($);
    const metaDescription = analyzeMetaDescription($);
    const h1 = analyzeH1($, title.value);
    const content = analyzeContent($);
    const images = analyzeImageAlts($);
    const links = analyzeLinks($, pageAbsUrl, rootOrigin);
    const structuredData = analyzeStructuredData($);

    if (title.value) {
      const key = title.value.trim().toLowerCase();
      titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
    }
    if (metaDescription.value) {
      const key = metaDescription.value.trim().toLowerCase();
      metaCounts.set(key, (metaCounts.get(key) || 0) + 1);
    }
    sentenceCountFrequency.set(content.uniqueSentenceCount, (sentenceCountFrequency.get(content.uniqueSentenceCount) || 0) + 1);

    const soft404Service = new Soft404Service();
    const soft404 = soft404Service.analyze(html, links.externalLinks + links.internalLinks);

    const isCanonicalConflict = !!(page.canonical && page.canonical !== page.url && page.canonical !== pageAbsUrl &&
      page.canonical.replace(/\/$/, '') !== pageAbsUrl.replace(/\/$/, ''));

    const resultPage: PageAnalysis = {
      url: page.url,
      status: page.status || 0,
      title,
      metaDescription,
      h1,
      content,
      thinScore: 0,
      images,
      links,
      structuredData,
      seoScore: 0,
      meta: {
        canonical: page.canonical,
        noindex: page.noindex,
        nofollow: page.nofollow,
        crawlStatus,
        canonicalConflict: isCanonicalConflict
      },
      soft404
    };

    Object.defineProperty(resultPage, 'html', { value: html, enumerable: false });
    results.push(resultPage);
  }

  for (const analysis of results) {
    if (analysis.title.value) {
      const key = analysis.title.value.trim().toLowerCase();
      if ((titleCounts.get(key) || 0) > 1) analysis.title.status = 'duplicate';
    }
    if (analysis.metaDescription.value) {
      const key = analysis.metaDescription.value.trim().toLowerCase();
      if ((metaCounts.get(key) || 0) > 1) analysis.metaDescription.status = 'duplicate';
    }
    const duplicationScore = (sentenceCountFrequency.get(analysis.content.uniqueSentenceCount) || 0) > 1 ? 100 : 0;
    analysis.thinScore = calculateThinContentScore(analysis.content, duplicationScore);
    analysis.seoScore = scorePageSeo(analysis);
  }

  return results;
}

function filterPageModules(page: PageAnalysis, modules: { seo: boolean; content: boolean; accessibility: boolean }): PageAnalysis {
  const filtered: PageAnalysis = {
    ...page,
    title: modules.seo ? page.title : { value: null, length: 0, status: 'missing' },
    metaDescription: modules.seo ? page.metaDescription : { value: null, length: 0, status: 'missing' },
    h1: (modules.seo || modules.content) ? page.h1 : { count: 0, status: 'critical', matchesTitle: false, value: null },
    links: modules.seo ? page.links : { internalLinks: 0, externalLinks: 0, nofollowCount: 0, externalRatio: 0 },
    structuredData: modules.seo ? page.structuredData : { present: false, valid: false, types: [] },
    content: modules.content ? page.content : { wordCount: 0, textHtmlRatio: 0, uniqueSentenceCount: 0 },
    thinScore: modules.content ? page.thinScore : 0,
    images: modules.accessibility ? page.images : { totalImages: 0, missingAlt: 0, emptyAlt: 0 }
  };
  if ((page as any).html) {
    Object.defineProperty(filtered, 'html', { value: (page as any).html, enumerable: false });
  }
  return filtered;
}

async function loadCrawlData(rootUrl: string, snapshotId?: number): Promise<CrawlData> {
  const db = getDb();
  const siteRepo = new SiteRepository(db);
  const snapshotRepo = new SnapshotRepository(db);
  const pageRepo = new PageRepository(db);

  const urlObj = new URL(rootUrl);
  const domain = urlObj.hostname.replace('www.', '');
  const site = siteRepo.firstOrCreateSite(domain);

  let snapshot = null;
  if (snapshotId) {
    snapshot = snapshotRepo.getSnapshot(snapshotId);
  }
  if (!snapshot) {
    const page = pageRepo.getPage(site.id, rootUrl);
    if (page?.last_seen_snapshot_id) {
      snapshot = snapshotRepo.getSnapshot(page.last_seen_snapshot_id);
    }
  }
  if (!snapshot) snapshot = snapshotRepo.getLatestSnapshot(site.id);
  if (!snapshot) throw new Error(`No crawl data found for ${rootUrl}`);

  const graph = loadGraphFromSnapshot(snapshot.id);
  const metrics = calculateMetrics(graph, 5);
  const dbPagesIterator = pageRepo.getPagesIteratorBySnapshot(snapshot.id);

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

async function runLiveCrawl(url: string, origin: string, options: AnalyzeOptions, context?: EngineContext, robots?: any): Promise<CrawlData> {
  const snapshotId = await crawl(url, {
    limit: 1,
    depth: 0,
    rate: options.rate,
    proxyUrl: options.proxyUrl,
    userAgent: options.userAgent,
    maxRedirects: options.maxRedirects,
    debug: options.debug,
    snapshotRunType: 'single',
    robots,
    sitemap: options.sitemap,
    plugins: options.plugins
  }, context) as number;
  const graph = loadGraphFromSnapshot(snapshotId);
  const pages = graph.getNodes().map((node) => ({
    url: node.url,
    status: node.status,
    html: node.html || '',
    depth: node.depth,
    crawlStatus: node.crawlStatus
  }));
  return { pages, metrics: calculateMetrics(graph, 1), graph, snapshotId };
}

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderAnalysisHtml(result: AnalysisResult): string {
  if (result.pages.length === 1) return renderSinglePageHtml(result.pages[0]);
  const rows = result.pages.map((page) => `<tr><td>${escapeHtml(page.url)}</td><td>${page.seoScore}</td><td>${page.thinScore}</td><td>${page.title.status}</td><td>${page.metaDescription.status}</td></tr>`).join('');
  return ANALYSIS_LIST_TEMPLATE.replace('{{PAGES_ANALYZED}}', result.site_summary.pages_analyzed.toString()).replace('{{AVG_SEO_SCORE}}', result.site_summary.avg_seo_score.toString()).replace('{{ROWS}}', rows);
}

function renderSinglePageHtml(page: PageAnalysis): string {
  const structuredDataStatus = page.structuredData.present ? (page.structuredData.valid ? '<span class="status-ok">Valid</span>' : '<span class="status-critical">Invalid JSON</span>') : 'Not detected';
  const structuredDataTypesRow = page.structuredData.present ? `<tr><th>Types Found</th><td>${page.structuredData.types.map(t => `<code>${t}</code>`).join(', ')}</td></tr>` : '';
  return ANALYSIS_PAGE_TEMPLATE.replaceAll('{{URL}}', escapeHtml(page.url)).replace('{{SEO_SCORE}}', page.seoScore.toString()).replace('{{THIN_SCORE}}', page.thinScore.toString()).replace('{{HTTP_STATUS}}', page.status === 0 ? 'Pending/Limit' : page.status.toString()).replace('{{TITLE_VALUE}}', escapeHtml(page.title.value || '(missing)')).replace('{{TITLE_LENGTH}}', page.title.length.toString()).replaceAll('{{TITLE_STATUS}}', page.title.status).replace('{{META_DESCRIPTION_VALUE}}', escapeHtml(page.metaDescription.value || '(missing)')).replace('{{META_DESCRIPTION_LENGTH}}', page.metaDescription.length.toString()).replaceAll('{{META_DESCRIPTION_STATUS}}', page.metaDescription.status).replace('{{CANONICAL}}', page.meta.canonical ? escapeHtml(page.meta.canonical) : '<em>(none)</em>').replace('{{ROBOTS_INDEX}}', (!page.meta.noindex).toString()).replace('{{ROBOTS_FOLLOW}}', (!page.meta.nofollow).toString()).replaceAll('{{H1_STATUS}}', page.h1.status).replace('{{H1_COUNT}}', page.h1.count.toString()).replace('{{H1_MATCHES_TITLE}}', page.h1.matchesTitle ? ' | Matches Title' : '').replace('{{WORD_COUNT}}', page.content.wordCount.toString()).replace('{{UNIQUE_SENTENCES}}', page.content.uniqueSentenceCount.toString()).replace('{{TEXT_HTML_RATIO}}', (page.content.textHtmlRatio * 100).toFixed(2)).replace('{{INTERNAL_LINKS}}', page.links.internalLinks.toString()).replace('{{EXTERNAL_LINKS}}', page.links.externalLinks.toString()).replace('{{EXTERNAL_RATIO}}', (page.links.externalRatio * 100).toFixed(1)).replace('{{TOTAL_IMAGES}}', page.images.totalImages.toString()).replace('{{MISSING_ALT}}', page.images.missingAlt.toString()).replace('{{STRUCTURED_DATA_STATUS}}', structuredDataStatus).replace('{{STRUCTURED_DATA_TYPES_ROW}}', structuredDataTypesRow);
}

export function renderAnalysisMarkdown(result: AnalysisResult): string {
  const summary = ['# Crawlith SEO Analysis Report', '', '## 📊 Summary', `- Pages Analyzed: ${result.site_summary.pages_analyzed}`, `- Overall Site Score: ${result.site_summary.site_score.toFixed(1)}`, `- Avg SEO Score: ${result.site_summary.site_score.toFixed(1)}`, `- Thin Pages Found: ${result.site_summary.thin_pages}`, `- Duplicate Titles: ${result.site_summary.duplicate_titles}`, '', '## 📄 Page Details', '', '| URL | SEO Score | Thin Score | Title Status | Meta Status | Canonical |', '| :--- | :--- | :--- | :--- | :--- | :--- |'];
  result.pages.forEach((page) => summary.push(`| ${page.url} | ${page.seoScore} | ${page.thinScore} | ${page.title.status} | ${page.metaDescription.status} | ${page.meta.canonical || '-'} |`));
  return summary.join('\n');
}

export function renderAnalysisCsv(result: AnalysisResult): string {
  const headers = ['URL', 'SEO Score', 'Thin Score', 'HTTP Status', 'Title', 'Title Length', 'Meta Description', 'Desc Length', 'Word Count', 'Internal Links', 'External Links', 'Canonical'];
  const rows = result.pages.map((p) => {
    const statusStr = p.status === 0 ? 'Pending/Limit' : p.status;
    return [p.url, p.seoScore, p.thinScore, statusStr, `"${(p.title.value || '').replace(/"/g, '""')}"`, p.title.length, `"${(p.metaDescription.value || '').replace(/"/g, '""')}"`, p.metaDescription.length, p.content.wordCount, p.links.internalLinks, p.links.externalLinks, p.meta.canonical || ''].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
