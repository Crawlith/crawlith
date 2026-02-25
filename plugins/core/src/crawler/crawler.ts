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

export class Crawler {
  private startUrl: string;
  private options: CrawlOptions;
  private visited: Set<string>;
  private uniqueQueue: Set<string>;
  private queue: QueueItem[];
  private active: number;
  private pagesCrawled: number;
  private reachedLimit: boolean;
  private maxDepthInCrawl: number;
  private concurrency: number;
  private limitConcurrency: ReturnType<typeof pLimit>;

  // Repositories
  private siteRepo: SiteRepository | null = null;
  private snapshotRepo: SnapshotRepository | null = null;
  private pageRepo: PageRepository | null = null;
  private edgeRepo: EdgeRepository | null = null;
  private metricsRepo: MetricsRepository | null = null;

  // Site/Snapshot info
  private siteId: number | null = null;
  private snapshotId: number | null = null;
  private rootOrigin: string = '';

  // Modules
  private scopeManager: ScopeManager | null = null;
  private fetcher: Fetcher | null = null;
  private parser: Parser | null = null;
  private sitemapFetcher: Sitemap | null = null;
  private trapDetector: TrapDetector | null = null;
  private robots: any = null;

  constructor(startUrl: string, options: CrawlOptions) {
    this.startUrl = startUrl;
    this.options = options;
    this.visited = new Set<string>();
    this.uniqueQueue = new Set<string>();
    this.queue = [];
    this.active = 0;
    this.pagesCrawled = 0;
    this.reachedLimit = false;
    this.maxDepthInCrawl = Math.min(options.depth, 10);
    this.concurrency = Math.min(options.concurrency || 2, 10);
    this.limitConcurrency = pLimit(this.concurrency);
  }

  async initialize(): Promise<void> {
    const db = getDb();
    this.siteRepo = new SiteRepository(db);
    this.snapshotRepo = new SnapshotRepository(db);
    this.pageRepo = new PageRepository(db);
    this.edgeRepo = new EdgeRepository(db);
    this.metricsRepo = new MetricsRepository(db);

    const rootUrl = normalizeUrl(this.startUrl, '', { stripQuery: this.options.stripQuery });
    if (!rootUrl) throw new Error('Invalid start URL');

    const urlObj = new URL(rootUrl);
    const domain = urlObj.hostname.replace('www.', '');
    const site = this.siteRepo.firstOrCreateSite(domain);
    this.siteId = site.id;

    this.snapshotId = this.snapshotRepo.createSnapshot(this.siteId, this.options.previousGraph ? 'incremental' : 'full');
    this.rootOrigin = urlObj.origin;
    this.startUrl = rootUrl;
  }

  setupModules(): void {
    this.scopeManager = new ScopeManager({
      allowedDomains: this.options.allowedDomains || [],
      deniedDomains: this.options.deniedDomains || [],
      includeSubdomains: this.options.includeSubdomains || false,
      rootUrl: this.startUrl
    });

    this.fetcher = new Fetcher({
      rate: this.options.rate,
      proxyUrl: this.options.proxyUrl,
      scopeManager: this.scopeManager,
      maxRedirects: this.options.maxRedirects,
      userAgent: this.options.userAgent
    });

    this.parser = new Parser();
    this.sitemapFetcher = new Sitemap();
    this.trapDetector = new TrapDetector();
  }

  async fetchRobots(): Promise<void> {
    if (!this.options.ignoreRobots) {
      try {
        const robotsUrl = new URL('/robots.txt', this.rootOrigin).toString();
        const res = await request(robotsUrl, {
          maxRedirections: 3,
          headers: { 'User-Agent': 'crawlith/1.0' },
          headersTimeout: 5000,
          bodyTimeout: 5000
        });
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const txt = await res.body.text();
          this.robots = (robotsParser as any)(robotsUrl, txt);
        } else {
          await res.body.dump();
        }
      } catch {
        console.warn('Failed to fetch robots.txt, proceeding...');
      }
    }
  }

  shouldEnqueue(url: string, depth: number): boolean {
    if (this.visited.has(url)) return false;
    if (this.uniqueQueue.has(url)) return false;
    if (depth > this.maxDepthInCrawl) return false;
    if (this.scopeManager!.isUrlEligible(url) !== 'allowed') return false;

    if (this.options.detectTraps) {
      const trap = this.trapDetector!.checkTrap(url, depth);
      if (trap.risk > 0.8) return false;
    }
    return true;
  }

  addToQueue(u: string, d: number): void {
    if (this.scopeManager!.isUrlEligible(u) !== 'allowed') return;
    if (!this.uniqueQueue.has(u)) {
      this.uniqueQueue.add(u);
      this.queue.push({ url: u, depth: d });
    }
  }

  async seedQueue(): Promise<void> {
    // Seed from Sitemap
    if (this.options.sitemap) {
      try {
        const sitemapUrl = this.options.sitemap === 'true' ? new URL('/sitemap.xml', this.rootOrigin).toString() : this.options.sitemap;
        if (sitemapUrl.startsWith('http')) {
          console.log(`Fetching sitemap: ${sitemapUrl}`);
          const sitemapUrls = await this.sitemapFetcher!.fetch(sitemapUrl);
          for (const u of sitemapUrls) {
            const normalized = normalizeUrl(u, '', this.options);
            if (normalized) this.addToQueue(normalized, 0);
          }
        }
      } catch (e) {
        console.warn('Sitemap fetch failed', e);
      }
    }

    // Seed from startUrl
    this.addToQueue(this.startUrl, 0);
  }

  private savePageToDb(url: string, depth: number, status: number, data: any = {}): number | null {
    try {
      const existing = this.pageRepo!.getPage(this.siteId!, url);
      const isSameSnapshot = existing?.last_seen_snapshot_id === this.snapshotId;

      return this.pageRepo!.upsertAndGetId({
        site_id: this.siteId!,
        normalized_url: url,
        depth: isSameSnapshot ? existing.depth : depth,
        http_status: status,
        first_seen_snapshot_id: existing ? existing.first_seen_snapshot_id : this.snapshotId!,
        last_seen_snapshot_id: this.snapshotId!,
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
  }

  private saveEdgeToDb(sourceUrl: string, targetUrl: string, weight: number = 1.0, rel: string = 'internal'): void {
    try {
      const sourceId = this.pageRepo!.getIdByUrl(this.siteId!, sourceUrl);
      const targetId = this.pageRepo!.getIdByUrl(this.siteId!, targetUrl);
      if (sourceId && targetId) {
        this.edgeRepo!.insertEdge(this.snapshotId!, sourceId, targetId, weight, rel);
      }
    } catch (e) {
      console.error(`Failed to save edge ${sourceUrl} -> ${targetUrl}:`, e);
    }
  }

  private async processPage(item: QueueItem): Promise<void> {
    const { url, depth } = item;
    if (this.scopeManager!.isUrlEligible(url) !== 'allowed') {
      this.savePageToDb(url, depth, 0, { securityError: 'blocked_by_domain_filter' });
      return;
    }

    const existingInDb = this.pageRepo!.getPage(this.siteId!, url);
    this.savePageToDb(url, depth, 0);

    try {
      const res = await this.fetcher!.fetch(url, {
        etag: existingInDb?.etag || undefined,
        lastModified: existingInDb?.last_modified || undefined,
        maxBytes: this.options.maxBytes,
        crawlDelay: this.robots ? this.robots.getCrawlDelay('crawlith') : undefined
      });

      if (this.options.debug) {
        console.log(`${chalk.gray(`[D:${depth}]`)} ${res.status} ${chalk.blue(url)}`);
      }

      if (res.status === 304) {
        this.savePageToDb(url, depth, 304);
        this.metricsRepo!.insertMetrics({
          snapshot_id: this.snapshotId!,
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
        const source = normalizeUrl(step.url, '', this.options);
        const target = normalizeUrl(step.target, '', this.options);
        if (source && target) {
          this.savePageToDb(source, depth, step.status);
          this.savePageToDb(target, depth, 0);
          this.saveEdgeToDb(source, target);
        }
      }

      const finalUrl = normalizeUrl(res.finalUrl, '', this.options);
      if (!finalUrl) return;

      const isStringStatus = typeof res.status === 'string';
      if (isStringStatus || (typeof res.status === 'number' && res.status >= 300)) {
        this.savePageToDb(finalUrl, depth, typeof res.status === 'number' ? res.status : 0, {
          securityError: isStringStatus ? res.status : undefined,
          retries: res.retries
        });
        return;
      }

      if (res.status === 200) {
        const contentTypeHeader = res.headers['content-type'];
        const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : (contentTypeHeader || '');
        if (!contentType || !contentType.toLowerCase().includes('text/html')) {
          this.savePageToDb(finalUrl, depth, res.status);
          return;
        }

        this.savePageToDb(finalUrl, depth, res.status);
        const parseResult = this.parser!.parse(res.body, finalUrl, res.status);

        const pageId = this.savePageToDb(finalUrl, depth, res.status, {
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
            const linkAnalysis = analyzeLinks(parseResult.html, finalUrl, this.rootOrigin);
            const thinScore = calculateThinContentScore(contentAnalysis, 0);

            this.metricsRepo!.insertMetrics({
              snapshot_id: this.snapshotId!,
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
          const normalizedLink = normalizeUrl(linkItem.url, '', this.options);
          if (normalizedLink && normalizedLink !== finalUrl) {
            this.savePageToDb(normalizedLink, depth + 1, 0);
            this.saveEdgeToDb(finalUrl, normalizedLink, 1.0, 'internal');
            if (this.shouldEnqueue(normalizedLink, depth + 1)) {
              this.addToQueue(normalizedLink, depth + 1);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error processing ${url}:`, e);
    }
  }

  async run(): Promise<number> {
    await this.initialize();
    this.setupModules();
    await this.fetchRobots();
    await this.seedQueue();

    return new Promise((resolve) => {
      const checkDone = () => {
        if (this.queue.length === 0 && this.active === 0) {
          this.snapshotRepo!.updateSnapshotStatus(this.snapshotId!, 'completed', {
            limit_reached: this.reachedLimit ? 1 : 0
          });
          resolve(this.snapshotId!);
          return true;
        }
        return false;
      };

      const next = () => {
        if (checkDone()) return;
        if (this.pagesCrawled >= this.options.limit) {
          this.reachedLimit = true;
          if (this.active === 0) {
            this.snapshotRepo!.updateSnapshotStatus(this.snapshotId!, 'completed', {
              limit_reached: 1
            });
            resolve(this.snapshotId!);
          }
          return;
        }

        while (this.queue.length > 0 && this.active < this.concurrency && this.pagesCrawled < this.options.limit) {
          const item = this.queue.shift()!;
          if (this.visited.has(item.url)) continue;
          if (this.robots && !this.robots.isAllowed(item.url, 'crawlith')) continue;

          this.active++;
          this.pagesCrawled++;
          this.visited.add(item.url);

          this.limitConcurrency(() => this.processPage(item)).finally(() => {
            this.active--;
            next();
          });
        }
      };
      next();
    });
  }
}
