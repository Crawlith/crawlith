import chalk from '../utils/chalk.js';
import pLimit from 'p-limit';
import robotsParser from 'robots-parser';
import { Graph, GraphNode } from '../graph/graph.js';
import { Fetcher, FetchResult } from './fetcher.js';
import { Parser } from './parser.js';
import { Sitemap } from './sitemap.js';
import { normalizeUrl, UrlUtil } from './normalize.js';
import { UrlResolver } from './resolver.js';
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
import { PluginRegistry } from '../plugin-system/plugin-registry.js';
import { DEFAULTS } from '../constants.js';

export interface CrawlOptions {
  limit: number;
  depth: number;
  concurrency?: number;
  ignoreRobots?: boolean;
  stripQuery?: boolean;
  previousGraph?: Graph;
  sitemap?: string | boolean;
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
  snapshotRunType?: 'completed' | 'incremental' | 'single';
  registry?: PluginRegistry;
  plugins?: any[];
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
  private registry?: PluginRegistry;
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
  private runType: 'completed' | 'incremental' | 'single' = 'completed';
  private rootOrigin: string = '';

  // Discovery tracking
  private discoveryDepths: Map<string, number> = new Map();

  // Buffers for batch operations
  private pageBuffer: Map<string, any> = new Map();
  private edgeBuffer: { sourceUrl: string; targetUrl: string; weight: number; rel: string }[] = [];
  private metricsBuffer: any[] = [];
  private pendingSitemaps: number = 0;

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
    this.registry = options.registry;
    this.visited = new Set<string>();
    this.uniqueQueue = new Set<string>();
    this.queue = [];
    this.active = 0;
    this.pagesCrawled = 0;
    this.reachedLimit = false;
    this.maxDepthInCrawl = Math.min(options.depth || DEFAULTS.MAX_DEPTH, DEFAULTS.MAX_DEPTH_LIMIT);
    this.concurrency = Math.min(options.concurrency || DEFAULTS.CONCURRENCY, DEFAULTS.CONCURRENCY_LIMIT);
    this.limitConcurrency = pLimit(this.concurrency);
  }

  async initialize(): Promise<void> {
    const db = getDb();
    this.siteRepo = new SiteRepository(db);
    this.snapshotRepo = new SnapshotRepository(db);
    this.pageRepo = new PageRepository(db);
    this.edgeRepo = new EdgeRepository(db);
    this.metricsRepo = new MetricsRepository(db);

    // Use resolver to find canonical origin and SSL
    const resolver = new UrlResolver();
    const tempFetcher = new Fetcher({ userAgent: this.options.userAgent, rate: this.options.rate });
    const resolved = await resolver.resolve(this.startUrl, tempFetcher);
    this.rootOrigin = resolved.url;

    // Use the resolved absolute URL as the base — NOT this.startUrl which may be
    // a bare domain (e.g. 'callforpaper.org') that would be treated as a relative
    // path when passed to normalizeUrl, producing '/callforpaper.org'.
    const rootUrl = normalizeUrl(this.rootOrigin, '', { stripQuery: this.options.stripQuery });
    if (!rootUrl) throw new Error('Invalid start URL');

    const urlObj = new URL(this.rootOrigin);
    const domain = urlObj.hostname.replace('www.', '');
    const site = this.siteRepo.firstOrCreateSite(domain);
    this.siteId = site.id;

    // Persist the resolved preferred URL and SSL status
    this.siteRepo.updateSitePreference(this.siteId, {
      preferred_url: this.rootOrigin,
      ssl: this.rootOrigin.startsWith('https') ? 1 : 0
    });

    // Use absolute URL as the primary key startUrl
    this.startUrl = rootUrl;
    this.rootOrigin = urlObj.origin;

    // Migrate legacy root-path rows ("/") to absolute root form ("https://site/").
    // This prevents duplicate records for the homepage key across older/newer crawl formats.
    this.pageRepo.reconcileRootUrl(this.siteId, this.rootOrigin);

    // Now that rootOrigin is resolved, initialize ScopeManager with the correct absolute origin
    this.scopeManager = new ScopeManager({
      allowedDomains: this.options.allowedDomains || [],
      deniedDomains: this.options.deniedDomains || [],
      includeSubdomains: this.options.includeSubdomains || false,
      rootUrl: this.rootOrigin
    });
    // Update fetcher with the now-initialized scopeManager
    if (this.fetcher) {
      (this.fetcher as any).scopeManager = this.scopeManager;
    }

    // Every scan now creates a new snapshot (no reuse)
    const runType = this.options.snapshotRunType || (this.options.previousGraph ? 'incremental' : 'completed');
    this.snapshotId = this.snapshotRepo.createSnapshot(this.siteId, runType);

    this.runType = runType;

    // Expose snapshot context for plugins that persist per-snapshot data.
    (this.context as any).snapshotId = this.snapshotId;

    // Seed discovery depth for root
    this.discoveryDepths.set(this.startUrl, 0);
  }

  setupModules(): void {
    this.fetcher = new Fetcher({
      rate: this.options.rate,
      proxyUrl: this.options.proxyUrl,
      scopeManager: this.scopeManager ?? undefined,
      maxRedirects: this.options.maxRedirects,
      userAgent: this.options.userAgent
    });

    this.parser = new Parser();
    this.sitemapFetcher = new Sitemap(this.context, this.fetcher!);
  }
  private async fetchRobots(): Promise<void> {
    const robotsUrl = new URL('/robots.txt', this.rootOrigin).toString();
    try {
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

    if (this.registry) {
      const allowed = this.registry.runSyncBailHook('shouldEnqueueUrl', this.context as any, url, depth);
      if (allowed === false) return false;
    }

    return true;
  }

  addToQueue(u: string, d: number, data: any = {}): void {
    if (this.scopeManager!.isUrlEligible(u) !== 'allowed') return;
    if (!this.uniqueQueue.has(u)) {
      this.uniqueQueue.add(u);
      this.queue.push({ url: u, depth: d });
      this.context.emit({ type: 'queue:enqueue', url: u, depth: d });

      this.bufferPage(u, d, 0, data);

      const currentDiscovery = this.discoveryDepths.get(u);
      if (currentDiscovery === undefined || d < currentDiscovery) {
        this.discoveryDepths.set(u, d);
      }
    }
  }

  async seedQueue(): Promise<void> {
    // Seed from startUrl first to ensure it's prioritized in the queue
    this.addToQueue(this.startUrl, 0);

    const sitemapsToFetch = new Set<string>();

    // 1. Explicitly configured sitemap
    if (this.options.sitemap && this.runType !== 'single') {
      const explicitUrl = this.options.sitemap === 'true' || (this.options.sitemap as any) === true
        ? new URL('/sitemap.xml', this.rootOrigin).toString()
        : this.options.sitemap;

      if (typeof explicitUrl === 'string' && explicitUrl.startsWith('http')) {
        sitemapsToFetch.add(explicitUrl);
      }
    }

    // 2. Discover sitemaps from robots.txt (unless explicitly disabled)
    // Only auto-fetch on the FIRST real crawl (full/incremental).
    // page --live reuses snapshots and should NOT trigger sitemap fetch.
    const isFirstFullCrawl = this.runType !== 'single' && !this.snapshotRepo?.hasFullCrawl(this.siteId!);
    if (this.options.sitemap !== false && (this.options.sitemap || isFirstFullCrawl) && this.robots && this.runType !== 'single') {
      const robotsSitemaps = this.robots.getSitemaps();
      for (const s of robotsSitemaps) {
        if (s) sitemapsToFetch.add(s);
      }
    }

    // Process all discovered sitemaps in background
    if (sitemapsToFetch.size > 0) {
      for (const sitemapUrl of sitemapsToFetch) {
        this.pendingSitemaps++;
        // KICK OFF BACKGROUND TASK (Un-awaited)
        (async () => {
          try {
            this.context.emit({ type: 'debug', message: 'Fetching sitemap in background', context: { url: sitemapUrl } });
            const sitemapUrls = await this.sitemapFetcher!.fetch(sitemapUrl);

            if (sitemapUrls.length > 0) {
              this.context.emit({ type: 'debug', message: `Mapping ${sitemapUrls.length} URLs from sitemap... (Background)` });
              const sitemapEntries = sitemapUrls.map(u => {
                const normalized = normalizeUrl(u, this.rootOrigin, this.options);
                if (!normalized) return null;
                const path = normalized;
                return {
                  site_id: this.siteId!,
                  normalized_url: path,
                  first_seen_snapshot_id: this.snapshotId!,
                  last_seen_snapshot_id: this.snapshotId!,
                  discovered_via_sitemap: 1,
                  depth: 0,
                  http_status: 0
                };
              }).filter((p): p is any => p !== null);

              // Bulk register to DB
              this.pageRepo!.upsertMany(sitemapEntries);

              // Add to queue for Actual Crawling
              for (const entry of sitemapEntries) {
                this.addToQueue(entry.normalized_url, 0, { discovered_via_sitemap: 1 });
              }
            }
          } catch (e) {
            this.context.emit({ type: 'warn', message: 'Sitemap fetch failed', context: { url: sitemapUrl, error: String(e) } });
          } finally {
            this.pendingSitemaps--;
          }
        })();
      }
    }
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
        crawl_status: null,
        word_count: null,
        thin_content_score: null,
        external_link_ratio: null,
        pagerank_score: null,
        hub_score: null,
        auth_score: null,
        link_role: null,
        duplicate_cluster_id: null,
        duplicate_type: null,
        cluster_id: null,
        soft404_score: null,
        heading_score: null,
        orphan_score: null,
        orphan_type: null,
        impact_level: null,
        heading_data: null,
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
    const path = url;
    const finalPath = finalUrl;
    this.bufferPage(finalPath, depth, prevNode.status, {
      html: prevNode.html,
      canonical_url: prevNode.canonical,
      noindex: prevNode.noindex ? 1 : 0,
      nofollow: prevNode.nofollow ? 1 : 0,
      content_hash: prevNode.contentHash,
      simhash: prevNode.simhash,
      etag: prevNode.etag,
      last_modified: prevNode.lastModified
    });

    this.bufferMetrics(finalPath, {
      crawl_status: 'cached',
      word_count: prevNode.wordCount,
      thin_content_score: prevNode.thinContentScore,
      external_link_ratio: prevNode.externalLinkRatio
    });
    // Re-discovery links from previous graph to continue crawling if needed
    const prevLinks = this.options.previousGraph?.getEdges()
      .filter(e => e.source === path)
      .map(e => e.target);

    if (prevLinks) {
      for (const link of prevLinks) {
        const normalizedLink = normalizeUrl(link, this.rootOrigin, this.options);
        if (normalizedLink) {
          const path = normalizedLink;
          if (path !== url) {
            this.bufferPage(path, depth + 1, 0);
            this.bufferEdge(url, path, 1.0, 'internal');
            if (this.shouldEnqueue(path, depth + 1)) {
              this.addToQueue(path, depth + 1);
            }
          }
        }
      }
    }
  }

  private handleRedirects(chain: FetchResult['redirectChain'], depth: number): void {
    for (const step of chain) {
      const sourceAbs = normalizeUrl(step.url, this.rootOrigin, this.options);
      const targetAbs = normalizeUrl(step.target, this.rootOrigin, this.options);
      if (sourceAbs && targetAbs) {
        const sourcePath = sourceAbs;
        const targetPath = targetAbs;
        const sourceInternal = UrlUtil.isInternal(sourceAbs, this.rootOrigin);
        const targetInternal = UrlUtil.isInternal(targetAbs, this.rootOrigin);
        this.bufferPage(sourcePath, depth, step.status, { is_internal: sourceInternal ? 1 : 0 });
        this.bufferPage(targetPath, depth, 0, { is_internal: targetInternal ? 1 : 0 });
        this.bufferEdge(sourcePath, targetPath, 1.0, targetInternal ? 'internal' : 'external');
      }
    }
  }

  private handleSuccessResponse(res: FetchResult, path: string, absoluteUrl: string, depth: number, isBlocked: boolean = false): void {
    const contentTypeHeader = res.headers['content-type'];
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : (contentTypeHeader || '');
    if (!contentType || !contentType.toLowerCase().includes('text/html')) {
      this.bufferPage(path, depth, typeof res.status === 'number' ? res.status : 0);
      return;
    }

    const parseResult = this.parser!.parse(res.body, absoluteUrl, res.status as number);

    if (this.registry) {
      this.registry.runHook('onPageParsed', this.context as any, {
        url: absoluteUrl,
        status: res.status,
        depth: depth,
        headers: res.headers,
        ...parseResult
      });
    }

    this.bufferPage(path, depth, res.status as number, {
      html: parseResult.html,
      canonical_url: parseResult.canonical || undefined,
      noindex: parseResult.noindex ? 1 : 0,
      nofollow: parseResult.nofollow ? 1 : 0,
      content_hash: parseResult.contentHash,
      simhash: parseResult.simhash,
      etag: res.etag,
      last_modified: res.lastModified,
      retries: res.retries,
      bytes_received: res.bytesReceived
    });

    try {
      const contentAnalysis = analyzeContent(parseResult.html);
      const linkAnalysis = analyzeLinks(parseResult.html, absoluteUrl, this.rootOrigin);
      const thinScore = calculateThinContentScore(contentAnalysis, 0);

      this.bufferMetrics(path, {
        crawl_status: isBlocked ? 'blocked_by_robots' : 'fetched',
        word_count: contentAnalysis.wordCount,
        thin_content_score: thinScore,
        external_link_ratio: linkAnalysis.externalRatio
      });
    } catch (e) {
      this.context.emit({ type: 'error', message: 'Error calculating per-page metrics', error: e, context: { url: absoluteUrl } });
    }

    for (const linkItem of parseResult.links) {
      const normalizedLink = normalizeUrl(linkItem.url, absoluteUrl, this.options);
      if (normalizedLink) {
        const targetPath = normalizedLink;

        if (targetPath !== path) {
          const isInternal = UrlUtil.isInternal(normalizedLink, this.rootOrigin);
          this.bufferPage(targetPath, depth + 1, 0, { is_internal: isInternal ? 1 : 0 });
          this.bufferEdge(path, targetPath, 1.0, isInternal ? 'internal' : 'external');

          if (isInternal && this.shouldEnqueue(targetPath, depth + 1)) {
            this.addToQueue(targetPath, depth + 1);
          }
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

    // Convert stored path to absolute URL for fetching.
    // External/subdomain URLs are already absolute (UrlUtil.toPath returns them as-is).
    const fetchUrl = UrlUtil.toAbsolute(url, this.rootOrigin);

    try {
      const prevNode = this.options.previousGraph?.nodes.get(url);
      const res = await this.fetchPage(fetchUrl, depth, prevNode);

      if (!res) return;

      const finalUrl = normalizeUrl(res.finalUrl, this.rootOrigin, this.options);
      if (!finalUrl) return;

      const fullUrl = finalUrl; // Already absolute
      const finalPath = finalUrl;

      if (res.status === 304 && prevNode) {
        this.handleCachedResponse(url, finalUrl, depth, prevNode);
        return;
      }

      this.handleRedirects(res.redirectChain, depth);

      const isStringStatus = typeof res.status === 'string';
      if (isStringStatus || (typeof res.status === 'number' && res.status >= 300)) {
        const statusNum = typeof res.status === 'number' ? res.status : 0;
        this.bufferPage(finalPath, depth, statusNum, {
          security_error: isStringStatus ? res.status : undefined,
          retries: res.retries
        });
        this.bufferMetrics(finalPath, {
          crawl_status: isStringStatus ? res.status : 'fetched_error'
        });
        return;
      }

      if (res.status === 200) {
        this.handleSuccessResponse(res, finalPath, fullUrl, depth, isBlocked);
      }
    } catch (e) {
      this.context.emit({ type: 'crawl:error', url, error: String(e), depth });
    }
  }

  async run(): Promise<number> {
    // 1. Setup fetcher and basic modules
    this.setupModules();

    // 2. Initialize repositories, resolve URL (SSL/WWW), and set up site context
    await this.initialize();

    if (this.options.robots) {
      this.robots = this.options.robots;
    } else {
      await this.fetchRobots();
    }
    await this.seedQueue();

    return new Promise((resolve) => {
      const checkDone = async () => {
        if (this.queue.length === 0 && this.active === 0 && this.pendingSitemaps === 0) {
          await this.flushAll();
          this.snapshotRepo!.updateSnapshotStatus(this.snapshotId!, 'completed', {
            limit_reached: this.reachedLimit ? 1 : 0
          });
          this.snapshotRepo!.pruneSnapshots(
            this.siteId!,
            DEFAULTS.MAX_SNAPSHOTS,
            DEFAULTS.MAX_SINGLE_SNAPSHOTS,
            this.snapshotId!
          );
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
            this.snapshotRepo!.pruneSnapshots(
              this.siteId!,
              DEFAULTS.MAX_SNAPSHOTS,
              DEFAULTS.MAX_SINGLE_SNAPSHOTS,
              this.snapshotId!
            );
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

          // Robust robots check: reconstruct absolute URL since robots-parser needs full URLs,
          // not root-relative paths. Also check /path/ variant in case robots.txt uses trailing slash.
          const absUrlForRobots = UrlUtil.toAbsolute(item.url, this.rootOrigin);
          const isBlocked = this.robots && (
            !this.robots.isAllowed(absUrlForRobots, 'crawlith') ||
            (!absUrlForRobots.endsWith('/') && !this.robots.isAllowed(absUrlForRobots + '/', 'crawlith'))
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
