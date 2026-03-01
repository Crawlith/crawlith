import chalk from 'chalk';
import pLimit from 'p-limit';
import robotsParser from 'robots-parser';
import { Graph, GraphNode } from '../graph/graph.js';
import { Fetcher, FetchResult } from './fetcher.js';
import { Parser } from './parser.js';
import { Sitemap } from './sitemap.js';
import { normalizeUrl } from './normalize.js';
import { ScopeManager } from '../core/scope/scopeManager.js';
import { getDb } from '../db/index.js';
import { SiteRepository } from '../db/repositories/SiteRepository.js';
import { SnapshotRepository } from '../db/repositories/SnapshotRepository.js';
import { PageRepository } from '../db/repositories/PageRepository.js';
import { EdgeRepository } from '../db/repositories/EdgeRepository.js';
import { MetricsRepository } from '../db/repositories/MetricsRepository.js';
import { analyzeContent, calculateThinContentScore } from '../analysis/content.js';
import { analyzeLinks } from '../analysis/links.js';
import { EngineContext } from '../events.js';
import { PluginManager } from '../plugin/manager.js';

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
  snapshotType?: 'full' | 'partial' | 'incremental';
  pluginManager?: PluginManager;
  robots?: any;
}

interface QueueItem {
  url: string;
  depth: number;
}

// Fallback context for backward compatibility or when no context is provided
const nullContext: EngineContext = {
  emit: (event) => {
    // Basic console fallback for critical events if no listener is attached
    // This maintains some visibility for consumers not using the event system
    if (event.type === 'error') {
      console.error(event.message, event.error || '');
    } else if (event.type === 'warn') {
      console.warn(event.message);
    }
  }
};

export class Crawler {
  private startUrl: string;
  private options: CrawlOptions;
  private context: EngineContext;
  private pluginManager?: PluginManager;
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
  private reusingSnapshot: boolean = false;
  private rootOrigin: string = '';

  // Discovery tracking
  private discoveryDepths: Map<string, number> = new Map();

  // Buffers for batch operations
  private pageBuffer: Map<string, any> = new Map();
  private edgeBuffer: { sourceUrl: string; targetUrl: string; weight: number; rel: string }[] = [];
  private metricsBuffer: any[] = [];

  // Modules
  private scopeManager: ScopeManager | null = null;
  private fetcher: Fetcher | null = null;
  private parser: Parser | null = null;
  private sitemapFetcher: Sitemap | null = null;
  private robots: any = null;

  constructor(startUrl: string, options: CrawlOptions, context?: EngineContext) {
    this.startUrl = startUrl;
    this.options = options;
    this.context = context || nullContext;
    this.pluginManager = options.pluginManager;
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

    // For partial snapshots (page --live), reuse the latest partial snapshot
    // instead of creating a new one each time
    if (this.options.snapshotType === 'partial') {
      const existing = this.snapshotRepo.getLatestPartialSnapshot(this.siteId);
      if (existing) {
        this.snapshotId = existing.id;
        this.reusingSnapshot = true;
        this.context.emit({ type: 'debug', message: `Reusing partial snapshot #${existing.id}` });
      } else {
        this.snapshotId = this.snapshotRepo.createSnapshot(this.siteId, 'partial');
      }
    } else {
      const type = this.options.snapshotType || (this.options.previousGraph ? 'incremental' : 'full');
      this.snapshotId = this.snapshotRepo.createSnapshot(this.siteId, type);
    }

    this.rootOrigin = urlObj.origin;
    this.startUrl = rootUrl;

    // Seed discovery depth for root
    this.discoveryDepths.set(this.startUrl, 0);
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
    this.sitemapFetcher = new Sitemap(this.context);
  }

  async fetchRobots(): Promise<void> {
    try {
      const robotsUrl = new URL('/robots.txt', this.rootOrigin).toString();
      const res = await this.fetcher!.fetch(robotsUrl, { maxBytes: 500000 });
      if (res && typeof res.status === 'number' && res.status >= 200 && res.status < 300) {
        this.robots = (robotsParser as any)(robotsUrl, res.body);
      }
    } catch {
      // Suppressed expected network warnings when robots block
      console.warn('Failed to fetch robots.txt, proceeding...');
    }
  }

  shouldEnqueue(url: string, depth: number): boolean {
    if (this.visited.has(url)) return false;
    if (this.uniqueQueue.has(url)) return false;
    if (depth > this.maxDepthInCrawl) return false;
    if (this.scopeManager!.isUrlEligible(url) !== 'allowed') return false;

    if (this.pluginManager) {
      const allowed = this.pluginManager.runSyncBailHook('shouldEnqueueUrl', url, depth, this.context);
      if (allowed === false) return false;
    }

    return true;
  }

  addToQueue(u: string, d: number): void {
    if (this.scopeManager!.isUrlEligible(u) !== 'allowed') return;
    if (!this.uniqueQueue.has(u)) {
      this.uniqueQueue.add(u);
      this.queue.push({ url: u, depth: d });
      this.context.emit({ type: 'queue:enqueue', url: u, depth: d });

      const currentDiscovery = this.discoveryDepths.get(u);
      if (currentDiscovery === undefined || d < currentDiscovery) {
        this.discoveryDepths.set(u, d);
      }
    }
  }

  async seedQueue(): Promise<void> {
    // Seed from Sitemap
    if (this.options.sitemap) {
      try {
        const sitemapUrl = this.options.sitemap === 'true' ? new URL('/sitemap.xml', this.rootOrigin).toString() : this.options.sitemap;
        if (sitemapUrl.startsWith('http')) {
          this.context.emit({ type: 'info', message: 'Fetching sitemap', context: { url: sitemapUrl } });
          const sitemapUrls = await this.sitemapFetcher!.fetch(sitemapUrl);
          for (const u of sitemapUrls) {
            const normalized = normalizeUrl(u, '', this.options);
            if (normalized) this.addToQueue(normalized, 0);
          }
        }
      } catch (e) {
        this.context.emit({ type: 'warn', message: 'Sitemap fetch failed', context: e });
      }
    }

    // Seed from startUrl
    this.addToQueue(this.startUrl, 0);
  }

  private bufferPage(url: string, depth: number, status: number, data: any = {}): void {
    const existing = this.pageBuffer.get(url);
    const knownDiscovery = this.discoveryDepths.get(url);

    // Always use the best (minimum) depth discovered for this URL
    const finalDepth = knownDiscovery !== undefined ? Math.min(knownDiscovery, depth) : depth;
    if (knownDiscovery === undefined || depth < knownDiscovery) {
      this.discoveryDepths.set(url, depth);
    }

    // If we already have a buffered record, only update if the new one is more "complete" (has status)
    // or if the depth is better.
    if (existing) {
      const isStatusUpdate = status !== 0 && existing.http_status === 0;
      const isBetterDepth = finalDepth < existing.depth;

      if (!isStatusUpdate && !isBetterDepth && Object.keys(data).length === 0) {
        return;
      }

      this.pageBuffer.set(url, {
        ...existing,
        depth: finalDepth,
        http_status: status !== 0 ? status : existing.http_status,
        ...data
      });
    } else {
      this.pageBuffer.set(url, {
        site_id: this.siteId!,
        normalized_url: url,
        depth: finalDepth,
        http_status: status,
        last_seen_snapshot_id: this.snapshotId!,
        ...data
      });
    }

    if (this.pageBuffer.size >= 50) {
      this.flushPages();
    }
  }

  private flushPages(): void {
    if (this.pageBuffer.size === 0) return;
    this.pageRepo!.upsertMany(Array.from(this.pageBuffer.values()));
    this.pageBuffer.clear();
  }

  private bufferEdge(sourceUrl: string, targetUrl: string, weight: number = 1.0, rel: string = 'internal'): void {
    this.edgeBuffer.push({ sourceUrl, targetUrl, weight, rel });
    if (this.edgeBuffer.length >= 100) {
      this.flushEdges();
    }
  }

  private flushEdges(): void {
    if (this.edgeBuffer.length === 0) return;

    // To resolve URLs to IDs, we need to make sure pages are flushed first
    this.flushPages();

    const identities = this.pageRepo!.getPagesIdentityBySnapshot(this.snapshotId!);
    const urlToId = new Map(identities.map(p => [p.normalized_url, p.id]));

    // When reusing a snapshot, clean up stale edges for pages being re-crawled
    if (this.reusingSnapshot) {
      const sourcePageIds = new Set(
        this.edgeBuffer.map(e => urlToId.get(e.sourceUrl)).filter((id): id is number => id !== undefined)
      );
      for (const pageId of sourcePageIds) {
        this.edgeRepo!.deleteEdgesForPage(this.snapshotId!, pageId);
      }
    }

    const edgesToInsert = this.edgeBuffer
      .map(e => ({
        snapshot_id: this.snapshotId!,
        source_page_id: urlToId.get(e.sourceUrl)!,
        target_page_id: urlToId.get(e.targetUrl)!,
        weight: e.weight,
        rel: e.rel as any
      }))
      .filter(e => e.source_page_id !== undefined && e.target_page_id !== undefined);

    if (edgesToInsert.length > 0) {
      this.edgeRepo!.insertEdges(edgesToInsert);
    }
    this.edgeBuffer = [];
  }

  private bufferMetrics(url: string, data: any): void {
    this.metricsBuffer.push({ url, data });
    if (this.metricsBuffer.length >= 50) {
      this.flushMetrics();
    }
  }

  private flushMetrics(): void {
    if (this.metricsBuffer.length === 0) return;

    this.flushPages();
    const identities = this.pageRepo!.getPagesIdentityBySnapshot(this.snapshotId!);
    const urlToId = new Map(identities.map(p => [p.normalized_url, p.id]));

    const metricsList = this.metricsBuffer.map(item => {
      const pageId = urlToId.get(item.url);
      if (!pageId) return null;
      return {
        snapshot_id: this.snapshotId!,
        page_id: pageId,
        authority_score: null,
        hub_score: null,
        pagerank: null,
        pagerank_score: null,
        link_role: null,
        crawl_status: null,
        word_count: null,
        thin_content_score: null,
        external_link_ratio: null,
        orphan_score: null,
        duplicate_cluster_id: null,
        duplicate_type: null,
        is_cluster_primary: 0,
        ...item.data
      };
    }).filter(m => m !== null);

    if (metricsList.length > 0) {
      this.metricsRepo!.insertMany(metricsList as any[]);
    }
    this.metricsBuffer = [];
  }

  async flushAll(): Promise<void> {
    this.flushPages();
    this.flushEdges();
    this.flushMetrics();
  }

  private async fetchPage(url: string, depth: number, prevNode?: GraphNode): Promise<FetchResult | null> {
    const startTime = Date.now();
    try {
      this.context.emit({ type: 'crawl:start', url });
      const res = await this.fetcher!.fetch(url, {
        maxBytes: this.options.maxBytes,
        crawlDelay: this.robots ? this.robots.getCrawlDelay('crawlith') : undefined,
        etag: prevNode?.etag,
        lastModified: prevNode?.lastModified
      });

      const durationMs = Date.now() - startTime;

      this.context.emit({
        type: 'crawl:success',
        url,
        status: typeof res.status === 'number' ? res.status : 0,
        durationMs,
        depth
      });

      return res;
    } catch (e) {
      this.context.emit({ type: 'crawl:error', url, error: String(e), depth });
      return null;
    }
  }

  private handleCachedResponse(url: string, finalUrl: string, depth: number, prevNode: GraphNode): void {
    this.bufferPage(finalUrl, depth, 200, {
      html: prevNode.html,
      canonical_url: prevNode.canonical,
      content_hash: prevNode.contentHash,
      simhash: prevNode.simhash,
      etag: prevNode.etag,
      last_modified: prevNode.lastModified,
      noindex: prevNode.noindex ? 1 : 0,
      nofollow: prevNode.nofollow ? 1 : 0
    });
    this.bufferMetrics(finalUrl, {
      crawl_status: 'cached'
    });

    // Re-discovery links from previous graph to continue crawling if needed
    const prevLinks = this.options.previousGraph?.getEdges()
      .filter(e => e.source === url)
      .map(e => e.target);

    if (prevLinks) {
      for (const link of prevLinks) {
        const normalizedLink = normalizeUrl(link, '', this.options);
        if (normalizedLink && normalizedLink !== finalUrl) {
          this.bufferPage(normalizedLink, depth + 1, 0);
          this.bufferEdge(finalUrl, normalizedLink, 1.0, 'internal');
          if (this.shouldEnqueue(normalizedLink, depth + 1)) {
            this.addToQueue(normalizedLink, depth + 1);
          }
        }
      }
    }
  }

  private handleRedirects(chain: FetchResult['redirectChain'], depth: number): void {
    for (const step of chain) {
      const source = normalizeUrl(step.url, '', this.options);
      const target = normalizeUrl(step.target, '', this.options);
      if (source && target) {
        this.bufferPage(source, depth, step.status);
        this.bufferPage(target, depth, 0);
        this.bufferEdge(source, target);
      }
    }
  }

  private handleSuccessResponse(res: FetchResult, finalUrl: string, depth: number, isBlocked: boolean = false): void {
    const contentTypeHeader = res.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : (contentTypeHeader || '');
    if (!contentType || !contentType.toLowerCase().includes('text/html')) {
      this.bufferPage(finalUrl, depth, typeof res.status === 'number' ? res.status : 0);
      return;
    }

    const parseResult = this.parser!.parse(res.body, finalUrl, res.status as number);

    this.bufferPage(finalUrl, depth, res.status as number, {
      html: parseResult.html,
      canonical_url: parseResult.canonical || undefined,
      noindex: parseResult.noindex ? 1 : 0,
      nofollow: parseResult.nofollow ? 1 : 0,
      content_hash: parseResult.contentHash,
      simhash: parseResult.simhash,
      soft404_score: parseResult.soft404Score,
      etag: res.etag,
      last_modified: res.lastModified,
      retries: res.retries
    });

    try {
      const contentAnalysis = analyzeContent(parseResult.html);
      const linkAnalysis = analyzeLinks(parseResult.html, finalUrl, this.rootOrigin);
      const thinScore = calculateThinContentScore(contentAnalysis, 0);

      this.bufferMetrics(finalUrl, {
        crawl_status: isBlocked ? 'blocked_by_robots' : 'fetched',
        word_count: contentAnalysis.wordCount,
        thin_content_score: thinScore,
        external_link_ratio: linkAnalysis.externalRatio
      });
    } catch (e) {
      this.context.emit({ type: 'error', message: 'Error calculating per-page metrics', error: e, context: { url: finalUrl } });
    }

    for (const linkItem of parseResult.links) {
      const normalizedLink = normalizeUrl(linkItem.url, '', this.options);
      if (normalizedLink && normalizedLink !== finalUrl) {
        this.bufferPage(normalizedLink, depth + 1, 0);
        this.bufferEdge(finalUrl, normalizedLink, 1.0, 'internal');
        if (this.shouldEnqueue(normalizedLink, depth + 1)) {
          this.addToQueue(normalizedLink, depth + 1);
        }
      }
    }
  }

  private async processPage(item: QueueItem, isBlocked: boolean = false): Promise<void> {
    const { url, depth } = item;
    if (this.scopeManager!.isUrlEligible(url) !== 'allowed') {
      this.bufferPage(url, depth, 0, { securityError: 'blocked_by_domain_filter' });
      return;
    }

    try {
      const prevNode = this.options.previousGraph?.nodes.get(url);
      const res = await this.fetchPage(url, depth, prevNode);

      if (!res) return;

      const finalUrl = normalizeUrl(res.finalUrl, '', this.options);
      if (!finalUrl) return;

      if (res.status === 304 && prevNode) {
        this.handleCachedResponse(url, finalUrl, depth, prevNode);
        return;
      }

      this.handleRedirects(res.redirectChain, depth);

      const isStringStatus = typeof res.status === 'string';
      if (isStringStatus || (typeof res.status === 'number' && res.status >= 300)) {
        const statusNum = typeof res.status === 'number' ? res.status : 0;
        this.bufferPage(finalUrl, depth, statusNum, {
          security_error: isStringStatus ? res.status : undefined,
          retries: res.retries
        });
        this.bufferMetrics(finalUrl, {
          crawl_status: isStringStatus ? res.status : 'fetched_error'
        });
        return;
      }

      if (res.status === 200) {
        this.handleSuccessResponse(res, finalUrl, depth, isBlocked);
      }
    } catch (e) {
      this.context.emit({ type: 'crawl:error', url, error: String(e), depth });
    }
  }

  async run(): Promise<number> {
    await this.initialize();
    this.setupModules();
    if (this.options.robots) {
      this.robots = this.options.robots;
    } else {
      await this.fetchRobots();
    }
    await this.seedQueue();

    return new Promise((resolve) => {
      const checkDone = async () => {
        if (this.queue.length === 0 && this.active === 0) {
          await this.flushAll();
          this.snapshotRepo!.updateSnapshotStatus(this.snapshotId!, 'completed', {
            limit_reached: this.reachedLimit ? 1 : 0
          });
          if (this.reusingSnapshot) {
            this.snapshotRepo!.touchSnapshot(this.snapshotId!);
          }
          resolve(this.snapshotId!);
          return true;
        }
        return false;
      };

      const next = async () => {
        if (await checkDone()) return;

        if (this.pagesCrawled >= this.options.limit) {
          this.reachedLimit = true;
          if (this.active === 0) {
            await this.flushAll();
            this.snapshotRepo!.updateSnapshotStatus(this.snapshotId!, 'completed', {
              limit_reached: 1
            });
            if (this.reusingSnapshot) {
              this.snapshotRepo!.touchSnapshot(this.snapshotId!);
            }
            this.context.emit({ type: 'crawl:limit-reached', limit: this.options.limit });
            resolve(this.snapshotId!);
          }
          return;
        }

        while (this.queue.length > 0 && this.active < this.concurrency && this.pagesCrawled < this.options.limit) {
          const item = this.queue.shift()!;
          if (this.visited.has(item.url)) continue;

          // Robust robots check: if path doesn't end in /, check both /path and /path/
          // to handle cases where normalization stripped a slash that robots.txt relies on.
          const isBlocked = this.robots && (
            !this.robots.isAllowed(item.url, 'crawlith') ||
            (!item.url.endsWith('/') && !this.robots.isAllowed(item.url + '/', 'crawlith'))
          );

          if (isBlocked) {
            if (this.options.debug) {
              console.log(`${chalk.yellow('⊘ Robots')} ${chalk.gray(item.url)}`);
            }

            // Tag as blocked for reporting
            this.bufferMetrics(item.url, {
              crawl_status: 'blocked_by_robots'
            });
            this.bufferPage(item.url, item.depth, 0);

            if (!this.options.ignoreRobots) {
              this.visited.add(item.url);
              this.pagesCrawled++;
              continue;
            }
          }

          this.active++;
          this.pagesCrawled++;
          this.visited.add(item.url);

          this.limitConcurrency(() => this.processPage(item, isBlocked)).finally(() => {
            this.active--;
            next();
          });
        }

        await checkDone();
      };
      next();
    });
  }
}