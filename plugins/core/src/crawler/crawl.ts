import { request } from 'undici';
import pLimit from 'p-limit';
import chalk from 'chalk';
import robotsParser from 'robots-parser';
import { Graph } from '../graph/graph.js';
import { Fetcher } from './fetcher.js';
import { Parser } from './parser.js';
import { Sitemap } from './sitemap.js';
import { normalizeUrl } from './normalize.js';
import { TrapDetector } from './trap.js';
import { ScopeManager } from '../core/scope/scopeManager.js';
import { getDb } from '../db/index.js';
import { SiteRepository } from '../db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../db/repositories/SnapshotRepository.js';
import { PageRepository } from '../db/repositories/PageRepository.js';
import { EdgeRepository } from '../db/repositories/EdgeRepository.js';
import { MetricsRepository } from '../db/repositories/MetricsRepository.js';
import { analyzeContent, calculateThinContentScore } from '../analysis/content.js';
import { analyzeLinks } from '../analysis/links.js';
import { runPostCrawlMetrics } from './metricsRunner.js';

export interface CrawlOptions {
  limit: number;
  depth: number;
  concurrency?: number;
  ignoreRobots?: boolean;
  stripQuery?: boolean;
  previousGraph?: Graph;
  sitemap?: string;
  debug?: boolean;
  detectSoft404?: boolean;
  detectTraps?: boolean;
  rate?: number;
  maxBytes?: number;
  allowedDomains?: string[];
  deniedDomains?: string[];
  includeSubdomains?: boolean;
  proxyUrl?: string;
  maxRedirects?: number;
  userAgent?: string;
}

interface QueueItem {
  url: string;
  depth: number;
}

export async function crawl(startUrl: string, options: CrawlOptions): Promise<number> {
  const visited = new Set<string>();
  const concurrency = Math.min(options.concurrency || 2, 10);
  const limitConcurrency = pLimit(concurrency);
  const trapDetector = new TrapDetector();

  const db = getDb();
  const siteRepo = new SiteRepository(db);
  const snapshotRepo = new SnapshotRepository(db);
  const pageRepo = new PageRepository(db);
  const edgeRepo = new EdgeRepository(db);
  const metricsRepo = new MetricsRepository(db);

  const rootUrl = normalizeUrl(startUrl, '', { stripQuery: options.stripQuery });
  if (!rootUrl) throw new Error('Invalid start URL');

  const urlObj = new URL(rootUrl);
  const domain = urlObj.hostname.replace('www.', '');
  const site = siteRepo.firstOrCreateSite(domain);
  const siteId = site.id;

  const snapshotId = snapshotRepo.createSnapshot(siteId, options.previousGraph ? 'incremental' : 'full');
  const rootOrigin = urlObj.origin;

  // DB Helper
  const savePageToDb = (url: string, depth: number, status: number, data: any = {}): number | null => {
    try {
      const existing = pageRepo.getPage(siteId!, url);
      const isSameSnapshot = existing?.last_seen_snapshot_id === snapshotId;

      return pageRepo.upsertAndGetId({
        site_id: siteId!,
        normalized_url: url,
        depth: isSameSnapshot ? existing.depth : depth,
        http_status: status,
        first_seen_snapshot_id: existing ? existing.first_seen_snapshot_id : snapshotId,
        last_seen_snapshot_id: snapshotId,
        canonical_url: data.canonical !== undefined ? data.canonical : existing?.canonical_url,
        content_hash: data.contentHash !== undefined ? data.contentHash : existing?.content_hash,
        simhash: data.simhash !== undefined ? data.simhash : existing?.simhash,
        etag: data.etag !== undefined ? data.etag : existing?.etag,
        last_modified: data.lastModified !== undefined ? data.lastModified : existing?.last_modified,
        html: data.html !== undefined ? data.html : existing?.html,
        soft404_score: data.soft404Score !== undefined ? data.soft404Score : existing?.soft404_score,
        noindex: data.noindex !== undefined ? (data.noindex ? 1 : 0) : existing?.noindex,
        nofollow: data.nofollow !== undefined ? (data.nofollow ? 1 : 0) : existing?.nofollow,
        security_error: data.securityError !== undefined ? data.securityError : existing?.security_error,
        retries: data.retries !== undefined ? data.retries : existing?.retries
      });
    } catch (e) {
      console.error(`Failed to save page ${url}:`, e);
      return null;
    }
  };

  const saveEdgeToDb = (sourceUrl: string, targetUrl: string, weight: number = 1.0, rel: string = 'internal') => {
    try {
      const sourceId = pageRepo.getIdByUrl(siteId!, sourceUrl);
      const targetId = pageRepo.getIdByUrl(siteId!, targetUrl);
      if (sourceId && targetId) {
        edgeRepo.insertEdge(snapshotId, sourceId, targetId, weight, rel);
      }
    } catch (e) {
      console.error(`Failed to save edge ${sourceUrl} -> ${targetUrl}:`, e);
    }
  };

  // Initialize Modules
  const scopeManager = new ScopeManager({
    allowedDomains: options.allowedDomains || [],
    deniedDomains: options.deniedDomains || [],
    includeSubdomains: options.includeSubdomains || false,
    rootUrl: startUrl
  });

  const fetcher = new Fetcher({
    rate: options.rate,
    proxyUrl: options.proxyUrl,
    scopeManager,
    maxRedirects: options.maxRedirects,
    userAgent: options.userAgent
  });

  const parser = new Parser();
  const sitemapFetcher = new Sitemap();

  // Handle robots.txt
  let robots: any = null;
  if (!options.ignoreRobots) {
    try {
      const robotsUrl = new URL('/robots.txt', rootOrigin).toString();
      const res = await request(robotsUrl, {
        maxRedirections: 3,
        headers: { 'User-Agent': 'crawlith/1.0' },
        headersTimeout: 5000,
        bodyTimeout: 5000
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const txt = await res.body.text();
        robots = (robotsParser as any)(robotsUrl, txt);
      } else {
        await res.body.dump();
      }
    } catch {
      console.warn('Failed to fetch robots.txt, proceeding...');
    }
  }

  // Queue Setup
  const queue: QueueItem[] = [];
  const uniqueQueue = new Set<string>();

  const addToQueue = (u: string, d: number) => {
    if (scopeManager.isUrlEligible(u) !== 'allowed') return;
    if (!uniqueQueue.has(u)) {
      uniqueQueue.add(u);
      queue.push({ url: u, depth: d });
    }
  };

  // Seed from Sitemap
  if (options.sitemap) {
    try {
      const sitemapUrl = options.sitemap === 'true' ? new URL('/sitemap.xml', rootOrigin).toString() : options.sitemap;
      if (sitemapUrl.startsWith('http')) {
        console.log(`Fetching sitemap: ${sitemapUrl}`);
        const sitemapUrls = await sitemapFetcher.fetch(sitemapUrl);
        for (const u of sitemapUrls) {
          const normalized = normalizeUrl(u, '', options);
          if (normalized) addToQueue(normalized, 0);
        }
      }
    } catch (e) {
      console.warn('Sitemap fetch failed', e);
    }
  }

  // Seed from startUrl
  addToQueue(rootUrl, 0);

  let pagesCrawled = 0;
  let active = 0;
  let reachedLimit = false;
  const maxDepthInCrawl = Math.min(options.depth, 10);

  const shouldEnqueue = (url: string, depth: number) => {
    if (visited.has(url)) return false;
    if (uniqueQueue.has(url)) return false;
    if (depth > maxDepthInCrawl) return false;
    if (scopeManager.isUrlEligible(url) !== 'allowed') return false;

    if (options.detectTraps) {
      const trap = trapDetector.checkTrap(url, depth);
      if (trap.risk > 0.8) return false;
    }
    return true;
  };

  return new Promise((resolve) => {
    const checkDone = () => {
      if (queue.length === 0 && active === 0) {
        snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', {
          limit_reached: reachedLimit ? 1 : 0
        });
        resolve(snapshotId);
        return true;
      }
      return false;
    };

    const next = () => {
      if (checkDone()) return;
      if (pagesCrawled >= options.limit) {
        reachedLimit = true;
        if (active === 0) {
          snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', {
            limit_reached: 1
          });
          resolve(snapshotId);
        }
        return;
      }

      while (queue.length > 0 && active < concurrency && pagesCrawled < options.limit) {
        const item = queue.shift()!;
        if (visited.has(item.url)) continue;
        if (robots && !robots.isAllowed(item.url, 'crawlith')) continue;

        active++;
        pagesCrawled++;
        visited.add(item.url);

        limitConcurrency(() => processPage(item)).finally(() => {
          active--;
          next();
        });
      }
    };

    const processPage = async (item: QueueItem) => {
      const { url, depth } = item;
      if (scopeManager.isUrlEligible(url) !== 'allowed') {
        savePageToDb(url, depth, 0, { securityError: 'blocked_by_domain_filter' });
        return;
      }

      const existingInDb = pageRepo.getPage(siteId!, url);
      savePageToDb(url, depth, 0);

      try {
        const res = await fetcher.fetch(url, {
          etag: existingInDb?.etag || undefined,
          lastModified: existingInDb?.last_modified || undefined,
          maxBytes: options.maxBytes,
          crawlDelay: robots ? robots.getCrawlDelay('crawlith') : undefined
        });

        if (options.debug) {
          console.log(`${chalk.gray(`[D:${depth}]`)} ${res.status} ${chalk.blue(url)}`);
        }

        if (res.status === 304) {
          savePageToDb(url, depth, 304);
          metricsRepo.insertMetrics({
            snapshot_id: snapshotId,
            page_id: existingInDb!.id,
            authority_score: null,
            hub_score: null,
            pagerank: null,
            pagerank_score: null,
            link_role: null,
            crawl_status: 'cached',
            word_count: null,
            thin_content_score: null,
            external_link_ratio: null,
            orphan_score: null,
            duplicate_cluster_id: null,
            duplicate_type: null,
            is_cluster_primary: 0
          });
          return;
        }

        const chain = res.redirectChain;
        for (const step of chain) {
          const source = normalizeUrl(step.url, '', options);
          const target = normalizeUrl(step.target, '', options);
          if (source && target) {
            savePageToDb(source, depth, step.status);
            savePageToDb(target, depth, 0);
            saveEdgeToDb(source, target);
          }
        }

        const finalUrl = normalizeUrl(res.finalUrl, '', options);
        if (!finalUrl) return;

        const isStringStatus = typeof res.status === 'string';
        if (isStringStatus || (typeof res.status === 'number' && res.status >= 300)) {
          savePageToDb(finalUrl, depth, typeof res.status === 'number' ? res.status : 0, {
            securityError: isStringStatus ? res.status : undefined,
            retries: res.retries
          });
          return;
        }

        if (res.status === 200) {
          const contentTypeHeader = res.headers['content-type'];
          const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : (contentTypeHeader || '');
          if (!contentType || !contentType.toLowerCase().includes('text/html')) {
            savePageToDb(finalUrl, depth, res.status);
            return;
          }

          savePageToDb(finalUrl, depth, res.status);
          const parseResult = parser.parse(res.body, finalUrl, res.status);

          const pageId = savePageToDb(finalUrl, depth, res.status, {
            html: parseResult.html,
            canonical: parseResult.canonical || undefined,
            noindex: parseResult.noindex,
            nofollow: parseResult.nofollow,
            contentHash: parseResult.contentHash,
            simhash: parseResult.simhash,
            soft404Score: parseResult.soft404Score,
            etag: res.etag,
            lastModified: res.lastModified,
            retries: res.retries
          });

          if (pageId) {
            try {
              const contentAnalysis = analyzeContent(parseResult.html);
              const linkAnalysis = analyzeLinks(parseResult.html, finalUrl, rootOrigin);
              const thinScore = calculateThinContentScore(contentAnalysis, 0);

              metricsRepo.insertMetrics({
                snapshot_id: snapshotId,
                page_id: pageId,
                authority_score: null,
                hub_score: null,
                pagerank: null,
                pagerank_score: null,
                link_role: null,
                crawl_status: 'fetched',
                word_count: contentAnalysis.wordCount,
                thin_content_score: thinScore,
                external_link_ratio: linkAnalysis.externalRatio,
                orphan_score: null,
                duplicate_cluster_id: null,
                duplicate_type: null,
                is_cluster_primary: 0
              });
            } catch (e) {
              console.error(`Error calculating per-page metrics for ${finalUrl}:`, e);
            }
          }

          for (const linkItem of parseResult.links) {
            const normalizedLink = normalizeUrl(linkItem.url, '', options);
            if (normalizedLink && normalizedLink !== finalUrl) {
              savePageToDb(normalizedLink, depth + 1, 0);
              saveEdgeToDb(finalUrl, normalizedLink, 1.0, 'internal');
              if (shouldEnqueue(normalizedLink, depth + 1)) {
                addToQueue(normalizedLink, depth + 1);
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error processing ${url}:`, e);
      }
    };
    next();
  });
}
