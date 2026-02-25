import fs from 'node:fs/promises';
import { crawl } from '../crawler/crawl.js';
import { loadGraphFromSnapshot } from '../db/graphLoader.js';
import { normalizeUrl } from '../crawler/normalize.js';
import { calculateMetrics, Metrics } from '../graph/metrics.js';
import { Graph, ClusterInfo } from '../graph/graph.js';
import { analyzeContent, calculateThinContentScore } from './content.js';
import { analyzeH1, analyzeMetaDescription, analyzeTitle, applyDuplicateStatuses, H1Analysis, TextFieldAnalysis } from './seo.js';
import { analyzeImageAlts, ImageAltAnalysis } from './images.js';
import { analyzeLinks, LinkRatioAnalysis } from './links.js';
import { analyzeStructuredData, StructuredDataResult } from './structuredData.js';
import { aggregateSiteScore, scorePageSeo } from './scoring.js';
import { detectContentClusters } from '../graph/cluster.js';
import { getDb } from '../db/index.js';
import { SiteRepository } from '../db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../db/repositories/SnapshotRepository.js';
import { PageRepository } from '../db/repositories/PageRepository.js';

export interface CrawlPage {
  url: string;
  status?: number;
  html?: string;
  depth?: number;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
}

export interface AnalyzeOptions {
  fromCrawl?: string;
  live?: boolean;
  html?: boolean;
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
}

interface CrawlData {
  pages: CrawlPage[];
  metrics: Metrics;
  graph: Graph;
}

export async function analyzeSite(url: string, options: AnalyzeOptions): Promise<AnalysisResult> {
  const normalizedRoot = normalizeUrl(url, '', { stripQuery: false });
  if (!normalizedRoot) {
    throw new Error('Invalid URL for analysis');
  }

  let crawlData: CrawlData;

  if (options.live) {
    crawlData = await runLiveCrawl(normalizedRoot, options);
  } else {
    try {
      crawlData = await loadCrawlData(normalizedRoot, options.fromCrawl);
    } catch (error: any) {
      const isNotFound = error.code === 'ENOENT' ||
        error.message.includes('Crawl data not found') ||
        error.message.includes('No completed snapshot found') ||
        error.message.includes('not found in database');
      if (isNotFound && !options.fromCrawl) {
        console.log('No local crawl data found. Switching to live analysis mode...');
        crawlData = await runLiveCrawl(normalizedRoot, options);
      } else {
        throw error;
      }
    }
  }

  // Run clustering if requested or as default
  detectContentClusters(crawlData.graph, options.clusterThreshold, options.minClusterSize);

  const pages = analyzePages(normalizedRoot, crawlData.pages);

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
  const resultPages = targetPage ? [targetPage] : (options.live ? filteredPages.slice(0, 1) : filteredPages);

  const duplicateTitles = pages.filter((page) => page.title.status === 'duplicate').length;
  const thinPages = pages.filter((page) => page.thinScore >= 70).length;
  const siteScores = aggregateSiteScore(crawlData.metrics, pages);

  return {
    site_summary: {
      pages_analyzed: pages.length,
      avg_seo_score: siteScores.seoHealthScore,
      thin_pages: thinPages,
      duplicate_titles: duplicateTitles,
      site_score: siteScores.overallScore
    },
    site_scores: siteScores,
    pages: resultPages,
    active_modules: activeModules,
    clusters: crawlData.graph.contentClusters
  };
}

export function renderAnalysisHtml(result: AnalysisResult): string {
  if (result.pages.length === 1) {
    return renderSinglePageHtml(result.pages[0]);
  }
  const rows = result.pages
    .map((page) => `< tr > <td>${escapeHtml(page.url)} </td><td>${page.seoScore}</td > <td>${page.thinScore} </td><td>${page.title.status}</td > <td>${page.metaDescription.status} </td></tr > `)
    .join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Crawlith Analysis Report</title></head><body><h1>Analysis</h1><p>Pages: ${result.site_summary.pages_analyzed}</p><p>Average SEO: ${result.site_summary.avg_seo_score}</p><table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>URL</th><th>SEO Score</th><th>Thin Score</th><th>Title</th><th>Meta</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function renderSinglePageHtml(page: PageAnalysis): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analysis for ${escapeHtml(page.url)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        h2 { margin-top: 30px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .score-card { display: flex; gap: 20px; margin-bottom: 30px; }
        .score-box { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; flex: 1; border: 1px solid #e1e4e8; }
        .score-val { font-size: 24px; font-weight: bold; color: #0366d6; }
        .status-ok { color: green; font-weight: bold; }
        .status-warning { color: orange; font-weight: bold; }
        .status-critical { color: red; font-weight: bold; }
        .status-missing { color: red; font-weight: bold; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .data-table th, .data-table td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
        .data-table th { width: 150px; color: #666; }
        code { background: #f6f8fa; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
    </style>
  </head>
  <body>
    <h1>Page Analysis</h1>
    <p><strong>URL:</strong> <a href="${page.url}" target="_blank">${page.url}</a></p>

    <div class="score-card">
      <div class="score-box">
        <div class="score-val">${page.seoScore}</div>
        <div>SEO Score</div>
      </div>
      <div class="score-box">
        <div class="score-val">${page.thinScore}</div>
        <div>Thin Content Score</div>
      </div>
      <div class="score-box">
        <div class="score-val">${page.status === 0 ? 'Pending/Limit' : page.status}</div>
        <div>HTTP Status</div>
      </div>
    </div>

    <h2>Meta Tags</h2>
    <table class="data-table">
      <tr>
        <th>Title</th>
        <td>
          <div>${escapeHtml(page.title.value || '(missing)')}</div>
          <small>Length: ${page.title.length} | Status: <span class="status-${page.title.status}">${page.title.status}</span></small>
        </td>
      </tr>
      <tr>
        <th>Description</th>
        <td>
          <div>${escapeHtml(page.metaDescription.value || '(missing)')}</div>
          <small>Length: ${page.metaDescription.length} | Status: <span class="status-${page.metaDescription.status}">${page.metaDescription.status}</span></small>
        </td>
      </tr>
      <tr>
        <th>Canonical</th>
        <td>${page.meta.canonical ? escapeHtml(page.meta.canonical) : '<em>(none)</em>'}</td>
      </tr>
      <tr>
        <th>Robots</th>
        <td>
          Index: ${!page.meta.noindex},
          Follow: ${!page.meta.nofollow}
        </td>
      </tr>
    </table>

    <h2>Content & Heading</h2>
    <table class="data-table">
      <tr>
        <th>H1 Tag</th>
        <td>
          Status: <span class="status-${page.h1.status}">${page.h1.status}</span>
          (${page.h1.count} detected)
          ${page.h1.matchesTitle ? ' | Matches Title' : ''}
        </td>
      </tr>
      <tr>
        <th>Word Count</th>
        <td>${page.content.wordCount} words</td>
      </tr>
      <tr>
        <th>Unique Sentences</th>
        <td>${page.content.uniqueSentenceCount}</td>
      </tr>
      <tr>
        <th>Text / HTML Ratio</th>
        <td>${(page.content.textHtmlRatio * 100).toFixed(2)}%</td>
      </tr>
    </table>

    <h2>Links & Images</h2>
    <table class="data-table">
      <tr>
        <th>Internal Links</th>
        <td>${page.links.internalLinks}</td>
      </tr>
      <tr>
        <th>External Links</th>
        <td>${page.links.externalLinks} (${(page.links.externalRatio * 100).toFixed(1)}%)</td>
      </tr>
      <tr>
        <th>Images</th>
        <td>${page.images.totalImages} total (${page.images.missingAlt} missing alt text)</td>
      </tr>
    </table>

    <h2>Structured Data</h2>
    <table class="data-table">
      <tr>
        <th>Status</th>
        <td>
          ${page.structuredData.present
      ? (page.structuredData.valid ? '<span class="status-ok">Valid</span>' : '<span class="status-critical">Invalid JSON</span>')
      : 'Not detected'
    }
        </td>
      </tr>
      ${page.structuredData.present ? `
      <tr>
          <th>Types Found</th>
          <td>${page.structuredData.types.map(t => `<code>${t}</code>`).join(', ')}</td>
      </tr>
      ` : ''}
    </table>
  </body>
</html>`;
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

function analyzePages(rootUrl: string, pages: CrawlPage[]): PageAnalysis[] {
  const titleCandidates = pages.map((page) => analyzeTitle(page.html || ''));
  const metaCandidates = pages.map((page) => analyzeMetaDescription(page.html || ''));
  const titles = applyDuplicateStatuses(titleCandidates);
  const metas = applyDuplicateStatuses(metaCandidates);

  const sentenceCountFrequency = new Map<number, number>();
  const baseContent = pages.map((page) => analyzeContent(page.html || ''));
  for (const item of baseContent) {
    sentenceCountFrequency.set(item.uniqueSentenceCount, (sentenceCountFrequency.get(item.uniqueSentenceCount) || 0) + 1);
  }

  return pages.map((page, index) => {
    const html = page.html || '';
    const title = titles[index];
    const metaDescription = metas[index];
    const h1 = analyzeH1(html, title.value);
    const content = baseContent[index];
    const duplicationScore = (sentenceCountFrequency.get(content.uniqueSentenceCount) || 0) > 1 ? 100 : 0;
    const thinScore = calculateThinContentScore(content, duplicationScore);
    const images = analyzeImageAlts(html);
    const links = analyzeLinks(html, page.url, rootUrl);
    const structuredData = analyzeStructuredData(html);

    const analysis: PageAnalysis = {
      url: page.url,
      status: page.status || 0,
      title,
      metaDescription,
      h1,
      content,
      thinScore,
      images,
      links,
      structuredData,
      seoScore: 0,
      meta: {
        canonical: page.canonical,
        noindex: page.noindex,
        nofollow: page.nofollow
      }
    };

    analysis.seoScore = scorePageSeo(analysis);
    return analysis;
  });
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

async function loadCrawlData(rootUrl: string, fromCrawl?: string): Promise<CrawlData> {
  // If fromCrawl is provided, we could theoretically load JSON, but 
  // we now default to DB fetching for all operations.

  if (fromCrawl) {
    try {
      const content = await fs.readFile(fromCrawl, 'utf-8');
      const raw = JSON.parse(content) as Record<string, unknown>;
      const pages = parsePages(raw);
      const graph = graphFromPages(rootUrl, pages, raw);
      const metrics = calculateMetrics(graph, 5);
      return { pages, metrics, graph };
    } catch (_e) {
      // Fallback downwards if file doesn't exist
    }
  }

  const db = getDb();
  const siteRepo = new SiteRepository(db);
  const snapshotRepo = new SnapshotRepository(db);
  const pageRepo = new PageRepository(db);

  const urlObj = new URL(rootUrl);
  const domain = urlObj.hostname.replace('www.', '');
  const site = siteRepo.firstOrCreateSite(domain);

  const snapshot = snapshotRepo.getLatestSnapshot(site.id, 'completed');
  if (!snapshot) {
    throw new Error(`No completed snapshot found for ${rootUrl} in database.`);
  }

  const graph = loadGraphFromSnapshot(snapshot.id);
  const metrics = calculateMetrics(graph, 5);

  // We also need the `pages` array for analysis. 
  // It needs `html` which might not be fully available unless we look up from the DB or Graph.
  // Wait, the Graph stores Node which doesn't contain HTML since we removed it from memory? 
  // Actually, `loadGraphFromSnapshot` does NOT load actual raw HTML from nodes to save memory.
  // We need HTML for `analyzeSite` module! So we must fetch it from `pageRepo`.

  const dbPages = pageRepo.getPagesBySnapshot(snapshot.id);
  const pages: CrawlPage[] = dbPages.map((p: any) => ({
    url: p.normalized_url,
    status: p.http_status || 0,
    html: p.html || '',
    depth: p.depth || 0
  }));

  return { pages, metrics, graph };
}

function parsePages(raw: Record<string, unknown>): CrawlPage[] {
  if (Array.isArray(raw.pages)) {
    return raw.pages.map((page) => {
      const p = page as Record<string, unknown>;
      return {
        url: String(p.url || ''),
        status: Number(p.status || 0),
        html: typeof p.html === 'string' ? p.html : '',
        depth: Number(p.depth || 0)
      };
    }).filter((page) => Boolean(page.url));
  }

  if (Array.isArray(raw.nodes)) {
    return raw.nodes.map((node) => {
      const n = node as Record<string, unknown>;
      return {
        url: String(n.url || ''),
        status: Number(n.status || 0),
        html: typeof n.html === 'string' ? n.html : '',
        depth: Number(n.depth || 0)
      };
    }).filter((page) => Boolean(page.url));
  }

  return [];
}

function graphFromPages(rootUrl: string, pages: CrawlPage[], raw: Record<string, unknown>): Graph {
  const graph = new Graph();

  for (const page of pages) {
    graph.addNode(page.url, page.depth || 0, page.status || 0);
  }

  if (Array.isArray(raw.edges)) {
    for (const edge of raw.edges) {
      const e = edge as Record<string, unknown>;
      if (typeof e.source === 'string' && typeof e.target === 'string') {
        graph.addNode(e.source, 0, 0);
        graph.addNode(e.target, 0, 0);
        graph.addEdge(e.source, e.target);
      }
    }
    return graph;
  }

  for (const page of pages) {
    if (!page.html) continue;
    const linkAnalysis = analyzeLinks(page.html, page.url, rootUrl);
    if (linkAnalysis.internalLinks === 0 && linkAnalysis.externalLinks === 0) continue;
  }

  return graph;
}

async function runLiveCrawl(url: string, options: AnalyzeOptions): Promise<CrawlData> {
  const snapshotId = await crawl(url, {
    limit: 1,
    depth: 0,
    rate: options.rate,
    proxyUrl: options.proxyUrl,
    userAgent: options.userAgent,
    maxRedirects: options.maxRedirects,
    debug: options.debug
  });
  const graph = loadGraphFromSnapshot(snapshotId);
  const pages = graph.getNodes().map((node) => ({
    url: node.url,
    status: node.status,
    html: node.html || '', // Include HTML
    depth: node.depth
  }));
  return {
    pages,
    metrics: calculateMetrics(graph, 1),
    graph
  };
}
