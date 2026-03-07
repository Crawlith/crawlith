import express from 'express';
import path from 'path';
import chalk from './utils/chalk.js';
import {
  getDb,
  closeDb,
  SiteRepository,
  SnapshotRepository,

  Snapshot,
  PageAnalysisUseCase,
  UrlUtil
} from '@crawlith/core';

export interface ServerOptions {
  port: number;
  host?: string;
  staticPath: string;
  siteId: number;
  snapshotId: number;
  plugins?: any[];
}

export function startServer(options: ServerOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const { port, host = '127.0.0.1', staticPath, siteId, snapshotId } = options;
    const resolvedStaticPath = path.resolve(staticPath);

    // Initialize DB and Repositories
    const db = getDb();
    const siteRepo = new SiteRepository(db);
    const snapshotRepo = new SnapshotRepository(db);
    // const pageRepo = new PageRepository(db);
    // const metricsRepo = new MetricsRepository(db);

    const app = express();
    const API_PREFIX = '/api';

    // Verify initial context
    const defaultSite = siteRepo.getSiteById(siteId);
    if (!defaultSite) {
      return reject(new Error(`Site ID ${siteId} not found.`));
    }

    // Check if snapshot exists
    const initialSnapshot = snapshotRepo.getSnapshot(snapshotId);
    if (!initialSnapshot) {
      return reject(new Error(`Snapshot ID ${snapshotId} not found.`));
    }

    console.log(chalk.gray(`   Loaded Context: ${defaultSite.domain} (Snapshot #${snapshotId})`));

    const pageLookupStmt = db.prepare('SELECT id, normalized_url, depth, bytes_received, http_status, redirect_chain FROM pages WHERE site_id = ? AND normalized_url = ?');
    const resolveRequestedSite = (req: express.Request) => {
      const selector = String(req.query.siteId || req.query.site || '').trim();
      if (!selector) return defaultSite;
      if (/^\d+$/.test(selector)) {
        return siteRepo.getSiteById(parseInt(selector, 10));
      }
      return siteRepo.getSite(UrlUtil.extractDomain(selector));
    };
    const resolvePage = (selectedSiteId: number, selectedSiteOrigin: string, inputUrl: string) => {
      const candidates = UrlUtil.toLookupCandidates(inputUrl, selectedSiteOrigin);
      for (const candidate of candidates) {
        const row = pageLookupStmt.get(selectedSiteId, candidate) as any;
        if (row) return row;
      }
      return null;
    };


    // API Router
    const api = express.Router();

    // Middleware to validate snapshotId query param
    const validateSnapshot = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const selectedSite = resolveRequestedSite(req);
      if (!selectedSite) {
        return res.status(404).json({ error: 'Site not found' });
      }

      const defaultFull = snapshotRepo.getLatestSnapshot(selectedSite.id, 'completed', false);
      const defaultAny = snapshotRepo.getLatestSnapshot(selectedSite.id, 'completed', true);
      const fallbackSnapshotId = defaultFull?.id || defaultAny?.id || snapshotId;
      const snapId = req.query.snapshot ? parseInt(req.query.snapshot as string, 10) : fallbackSnapshotId;

      // Basic validation: ensure snapshot belongs to site
      const snap = snapshotRepo.getSnapshot(snapId);
      if (!snap || snap.site_id !== selectedSite.id) {
        return res.status(404).json({ error: 'Snapshot not found or does not belong to this site' });
      }

      (req as any).siteId = selectedSite.id;
      (req as any).site = selectedSite;
      (req as any).siteOrigin = UrlUtil.resolveSiteOrigin(selectedSite);
      (req as any).snapshotId = snapId;
      (req as any).snapshot = snap;
      next();
    };

    // ── Rate Limiting ─────────────────────────────────────────────
    function createRateLimiter(maxRequests: number, windowMs: number) {
      const hits = new Map<string, number[]>();

      // Cleanup stale entries every 5 minutes
      setInterval(() => {
        const now = Date.now();
        for (const [key, timestamps] of hits) {
          const valid = timestamps.filter(t => now - t < windowMs);
          if (valid.length === 0) hits.delete(key);
          else hits.set(key, valid);
        }
      }, 5 * 60 * 1000).unref();

      return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const key = req.ip || '127.0.0.1';
        const now = Date.now();
        const timestamps = (hits.get(key) || []).filter(t => now - t < windowMs);

        if (timestamps.length >= maxRequests) {
          const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000);
          res.set('Retry-After', String(retryAfter));
          return res.status(429).json({
            error: 'Too many requests',
            retryAfter
          });
        }

        timestamps.push(now);
        hits.set(key, timestamps);

        res.set('X-RateLimit-Limit', String(maxRequests));
        res.set('X-RateLimit-Remaining', String(maxRequests - timestamps.length));
        next();
      };
    }

    // General: 60 requests per minute (read endpoints)
    const rateLimiter = createRateLimiter(60, 60 * 1000);
    // Strict: 5 requests per minute (crawl/write endpoints)
    const strictRateLimiter = createRateLimiter(5, 60 * 1000);

    // Apply general rate limit to all API routes
    api.use(rateLimiter);

    api.get('/sites', (_req, res) => {
      const sites = siteRepo.getAllSites().map((s) => {
        const latestFull = snapshotRepo.getLatestSnapshot(s.id, 'completed', false);
        return {
          id: s.id,
          domain: s.domain,
          latestSnapshotId: latestFull?.id ?? null
        };
      });
      res.json({ results: sites });
    });

    // 4.1 GET /api/context
    api.get('/context', (req, res) => {
      const selectedSite = resolveRequestedSite(req);
      if (!selectedSite) return res.status(404).json({ error: 'Site not found' });
      const latestFullSnapshot = snapshotRepo.getLatestSnapshot(selectedSite.id, 'completed', false);
      const latestSnapshot = snapshotRepo.getLatestSnapshot(selectedSite.id, 'completed', true);

      res.json({
        siteId: selectedSite.id,
        snapshotId: latestFullSnapshot?.id || latestSnapshot?.id || snapshotId,
        latestSnapshotId: latestFullSnapshot?.id || latestSnapshot?.id || snapshotId,
        latestAnySnapshotId: latestSnapshot?.id || snapshotId,
        domain: selectedSite.domain,
        createdAt: selectedSite.created_at
      });
    });

    // 4.2 GET /api/overview
    api.get('/overview', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const snap = (req as any).snapshot as Snapshot;
      const currentSiteId = (req as any).siteId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;

      // Get previous snapshot for comparison
      const previousSnapshot = db.prepare(`
        SELECT id, created_at, health_score
        FROM snapshots
        WHERE site_id = ? AND id < ? AND run_type != 'single'
        ORDER BY id DESC
        LIMIT 1
      `).get(currentSiteId, currentSnapshotId) as { id: number, health_score: number } | undefined;

      // Aggregates from metrics table
      const metricsAgg = db.prepare(`
        SELECT
          COUNT(CASE WHEN duplicate_cluster_id IS NOT NULL AND is_cluster_primary = 0 THEN 1 END) as duplicate_pages
        FROM metrics
        WHERE snapshot_id = ?
      `).get(currentSnapshotId) as any;

      // Actual cluster counts from the specific tables
      const clustersCount = db.prepare(`
        SELECT COUNT(*) as count FROM duplicate_clusters WHERE snapshot_id = ?
      `).get(currentSnapshotId) as { count: number };

      // Aggregates from pages & metrics table for the specific snapshot
      const pagesAgg = db.prepare(`
        SELECT
           COUNT(*) as total_pages,
           COUNT(CASE WHEN m.crawl_status IN ('fetched', 'cached', 'fetched_error') THEN 1 END) as crawled_pages,
           COUNT(CASE WHEN (
             p.http_status >= 400 OR 
             (p.http_status = 0 AND m.crawl_status IN ('network_error', 'failed_after_retries', 'fetched_error')) OR
             p.security_error IS NOT NULL
           ) THEN 1 END) as broken_node_count,
           COUNT(CASE WHEN p.http_status >= 500 THEN 1 END) as server_errors,
           COUNT(CASE WHEN p.redirect_chain IS NOT NULL AND json_array_length(p.redirect_chain) > 1 THEN 1 END) as redirect_chains,
           COUNT(CASE WHEN p.noindex = 1 THEN 1 END) as noindex_pages,
           COUNT(CASE WHEN 
             p.canonical_url IS NOT NULL AND 
             p.canonical_url != p.normalized_url AND 
             p.canonical_url != (? || p.normalized_url) AND
             p.canonical_url != (? || p.normalized_url || '/') AND
             REPLACE(p.canonical_url, '/', '') != REPLACE(? || p.normalized_url, '/', '')
           THEN 1 END) as canonical_issues,
           COUNT(CASE WHEN m.crawl_status = 'blocked_by_robots' THEN 1 END) as blocked_robots,
           COUNT(CASE WHEN p.crawl_trap_flag = 1 THEN 1 END) as crawl_traps
        FROM metrics m
        JOIN pages p ON m.page_id = p.id
        WHERE m.snapshot_id = ? AND p.is_internal = 1
      `).get(currentSiteOrigin, currentSiteOrigin, currentSiteOrigin, currentSnapshotId) as any;

      // Internal links count (sum of all internal edges)
      const linksCount = db.prepare('SELECT COUNT(*) as count FROM edges WHERE snapshot_id = ? AND rel = ?').get(currentSnapshotId, 'internal') as { count: number };


      res.json({
        health: {
          score: snap.health_score ?? 0,
          status: (snap.health_score ?? 0) > 80 ? 'Good' : (snap.health_score ?? 0) > 50 ? 'Warning' : 'Critical',
          delta: previousSnapshot ? Math.round(((snap.health_score ?? 0) - (previousSnapshot.health_score ?? 0)) * 100) / 100 : 0
        },
        totals: {
          discovered: pagesAgg.total_pages,
          crawled: pagesAgg.crawled_pages,
          internalLinks: linksCount.count,
          duplicateClusters: clustersCount.count,
          duplicatePages: metricsAgg.duplicate_pages,
          orphanPages: snap.orphan_count ?? 0,
          brokenLinks: pagesAgg?.broken_node_count || 0,
          serverErrors: pagesAgg?.server_errors || 0,
          redirectChains: pagesAgg?.redirect_chains || 0,
          noindexPages: pagesAgg?.noindex_pages || 0,
          canonicalIssues: pagesAgg?.canonical_issues || 0,
          thinContent: snap.thin_content_count || 0,
          blockedRobots: pagesAgg?.blocked_robots || 0,
          crawlTraps: pagesAgg?.crawl_traps || 0
        },
        crawl: {
          durationMs: 0, // Not stored currently
          avgDepth: 0, // Need to compute
          efficiency: 100
        },
        snapshotId: currentSnapshotId
      });
    });

    api.get('/issues', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const currentSiteId = (req as any).siteId as number;
      const currentSite = (req as any).site as any;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const severity = req.query.severity as string;
      const search = req.query.search as string;
      const pageNum = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '50', 10);
      const offset = (pageNum - 1) * pageSize;

      // We fetch all potential pages and filter them in JS for richer logic
      // In a larger system, this would be moved to a SQL VIEW or materialized table
      let sql = `
        SELECT
          p.normalized_url as url,
          p.http_status,
          p.noindex,
          p.redirect_chain,
          m.pagerank_score as pageRankScore,
          m.duplicate_type,
          m.thin_content_score,
          m.word_count,
          m.link_role,
          m.crawl_status,
          p.security_error,
          p.canonical_url,
          s.created_at as lastSeen
        FROM pages p
        JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
        JOIN snapshots s ON m.snapshot_id = s.id
        WHERE p.site_id = ? AND p.is_internal = 1
      `;

      const params: any[] = [currentSnapshotId, currentSiteId];

      if (search) {
        sql += ' AND p.normalized_url LIKE ?';
        params.push(`%${search}%`);
      }

      sql += ' ORDER BY m.pagerank_score DESC';

      const results = db.prepare(sql).all(...params) as any[];

      const allIssues = results.map((r: any) => {
        let issueType = 'Page';
        let sev = 'Info' as 'Critical' | 'Warning' | 'Info';
        let impactFactor = 0;
        let isProblematic = false;

        const importanceMultiplier = 0.5 + ((r.pageRankScore || 0) / 200); // 0.5 to 1.0

        const isNetworkError = (r.http_status === 0 && (r.crawl_status === 'network_error' || r.crawl_status === 'failed_after_retries' || r.crawl_status === 'fetched_error')) || r.security_error !== null;
        const isHttpError = r.http_status >= 400;

        if (isHttpError || isNetworkError) {
          issueType = 'Broken Link';
          sev = 'Critical';
          impactFactor = 80;
          isProblematic = true;
        } else if (r.redirect_chain) {
          issueType = 'Redirect Chain';
          sev = 'Warning';
          impactFactor = 40;
          isProblematic = true;
        } else if (r.noindex) {
          issueType = 'Indexability Risk';
          sev = 'Warning';
          impactFactor = 30;
          isProblematic = true;
        } else if (r.word_count > 0 && r.thin_content_score > 70) {
          issueType = 'Thin Content';
          sev = 'Warning';
          impactFactor = 25;
          isProblematic = true;
        } else if (r.word_count > 0 && r.word_count < 200) {
          issueType = 'Low Word Count';
          sev = 'Warning';
          impactFactor = 30;
          isProblematic = true;
        } else if (r.word_count > 0 && r.duplicate_type && r.duplicate_type !== 'none') {
          issueType = `Duplicate Content`;
          sev = 'Info';
          impactFactor = 10;
          isProblematic = true;
        } else if (r.link_role === 'orphan') {
          issueType = 'Orphan Page';
          sev = 'Warning';
          impactFactor = 20;
          isProblematic = true;
        } else if (r.canonical_url) {
          const isConflict = r.canonical_url !== r.url &&
            r.canonical_url !== (currentSiteOrigin + r.url) &&
            r.canonical_url.replace(/\/$/, '') !== (currentSiteOrigin + r.url).replace(/\/$/, '');

          if (isConflict) {
            issueType = 'Canonical Conflict';
            sev = 'Warning';
            impactFactor = 15;
            isProblematic = true;
          }
        }

        return {
          url: r.url,
          issueType,
          severity: sev,
          impactScore: Math.round(impactFactor * importanceMultiplier),
          pageRank: r.pageRankScore,
          pageRankScore: r.pageRankScore,
          lastSeen: r.lastSeen,
          isProblematic
        };
      });

      // Filter: Only problematic ones by default, unless searching
      let filtered = allIssues;
      if (!search && (!severity || severity === 'All')) {
        filtered = allIssues.filter(i => {
          if (!i.isProblematic) return false;
          // Filter out external URLs that aren't errors from the main issues list
          if (i.url.startsWith('http') && !i.url.includes(currentSite.domain) && i.severity === 'Info') return false;
          return true;
        });
      } else if (severity && severity !== 'All') {
        filtered = allIssues.filter(i => i.severity === severity);
      }

      // If we filtered out EVERYTHING and user isn't searching, maybe show something? 
      // No, let's be strict. If it's a healthy site, show 0 issues.

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + pageSize);

      res.json({
        total,
        page: pageNum,
        pageSize,
        results: paginated
      });
    });

    // 4.4 GET /api/metrics/top-pagerank
    api.get('/metrics/top-pagerank', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const rows = db.prepare(`
        SELECT p.normalized_url as url, m.pagerank_score as pageRank, m.auth_score as authorityScore, m.hub_score as hubScore
        FROM metrics m
        JOIN pages p ON m.page_id = p.id
        WHERE m.snapshot_id = ? AND p.is_internal = 1
        ORDER BY m.pagerank_score DESC
        LIMIT 10
      `).all(currentSnapshotId);

      res.json({ results: rows });
    });

    // 4.5 GET /api/metrics/depth-distribution
    api.get('/metrics/depth-distribution', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      // Depth is stored on pages table, but it's constant per crawl usually.
      // Actually depth is property of crawl traversal.
      // We'll aggregate from pages table for pages seen in this snapshot.
      const rows = db.prepare(`
            SELECT depth, COUNT(*) as count
            FROM pages
            JOIN snapshots s ON pages.site_id = s.site_id
            WHERE s.id = ? AND pages.first_seen_snapshot_id <= ?
            GROUP BY depth
            ORDER BY depth ASC
        `).all(currentSnapshotId, currentSnapshotId);

      res.json({ buckets: rows });
    });

    // 4.6 GET /api/metrics/duplicate-clusters
    api.get('/metrics/duplicate-clusters', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const rows = db.prepare(`
            SELECT size, COUNT(*) as count
            FROM duplicate_clusters
            WHERE snapshot_id = ?
            GROUP BY size
            ORDER BY size ASC
        `).all(currentSnapshotId);

      res.json({ buckets: rows });
    });

    // 4.7 GET /api/metrics/depth-pages
    api.get('/metrics/depth-pages', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const rows = db.prepare(`
        SELECT
          p.depth as depth,
          p.normalized_url as url,
          p.http_status as status,
          COALESCE(m.pagerank_score, 0) as pageRankScore
        FROM metrics m
        JOIN pages p ON m.page_id = p.id
        WHERE m.snapshot_id = ? AND p.is_internal = 1
        ORDER BY p.depth ASC, m.pagerank_score DESC, p.normalized_url ASC
      `).all(currentSnapshotId) as { depth: number; url: string; status: number; pageRankScore: number }[];

      const grouped = new Map<number, { depth: number; count: number; pages: { url: string; fullUrl: string; status: number; pageRankScore: number }[] }>();

      for (const row of rows) {
        if (!grouped.has(row.depth)) {
          grouped.set(row.depth, { depth: row.depth, count: 0, pages: [] });
        }

        const bucket = grouped.get(row.depth)!;
        bucket.pages.push({
          url: row.url,
          fullUrl: UrlUtil.toAbsolute(row.url, currentSiteOrigin),
          status: row.status,
          pageRankScore: row.pageRankScore
        });
        bucket.count += 1;
      }

      res.json({
        results: Array.from(grouped.values()).sort((a, b) => a.depth - b.depth)
      });
    });

    // 4.8 GET /api/snapshots
    api.get('/snapshots', (req, res) => {
      const selectedSite = resolveRequestedSite(req);
      if (!selectedSite) return res.status(404).json({ error: 'Site not found' });
      const includeSingle = req.query.includeSingle === 'true' || req.query.includeSingle === '1';
      const sql = includeSingle
        ? 'SELECT id, run_type as type, created_at as createdAt FROM snapshots WHERE site_id = ? ORDER BY created_at DESC'
        : 'SELECT id, run_type as type, created_at as createdAt FROM snapshots WHERE site_id = ? AND run_type != \'single\' ORDER BY created_at DESC';
      const rows = db.prepare(sql).all(selectedSite.id);
      res.json({ results: rows });
    });

    // 5.1 GET /api/page
    api.get('/page', validateSnapshot, async (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const currentSiteId = (req as any).siteId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const url = req.query.url as string;

      if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      const urlForAnalysis = UrlUtil.toAbsolute(url, currentSiteOrigin);

      try {
        // Use the same PageAnalysisUseCase as the CLI's `page` command
        const useCase = new PageAnalysisUseCase();
        const result = await useCase.execute({
          url: urlForAnalysis,
          snapshotId: currentSnapshotId,
          seo: true,
          content: true,
          accessibility: true,
        });

        const page = result.pages[0];
        if (!page) {
          return res.status(404).json({ error: 'Page not found' });
        }

        const targetSnapshotId = result.snapshotId;

        // Enrich with DB-level graph metrics (pagerank, inlinks, outlinks)
        // These are graph-level concerns not part of the page analysis use case
        const dbPageQuery = db.prepare(`
          SELECT p.id, p.depth,
            m.pagerank_score, m.auth_score, m.hub_score, m.heading_data
          FROM pages p
          LEFT JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
          WHERE p.site_id = ? AND p.normalized_url = ?
        `);
        const lookupCandidates = UrlUtil.toLookupCandidates(url, currentSiteOrigin);
        let dbPage: any = null;
        for (const candidate of lookupCandidates) {
          dbPage = dbPageQuery.get(targetSnapshotId, currentSiteId, candidate) as any;
          if (dbPage) break;
        }

        let inlinks = 0, outlinks = 0;
        let latestSnapshotIdForPage: number | undefined = undefined;
        if (dbPage) {
          const inlinksCount = db.prepare(`
            SELECT COUNT(*) as count FROM edges
            WHERE snapshot_id = ? AND target_page_id = ? AND rel = 'internal'
          `).get(targetSnapshotId, dbPage.id) as { count: number };
          const outlinksCount = db.prepare(`
            SELECT COUNT(*) as count FROM edges
            WHERE snapshot_id = ? AND source_page_id = ? AND rel = 'internal'
          `).get(targetSnapshotId, dbPage.id) as { count: number };

          const latestSnapQuery = db.prepare(`
            SELECT MAX(m.snapshot_id) as maxId
            FROM metrics m
            JOIN pages p ON m.page_id = p.id
            JOIN snapshots s ON s.id = m.snapshot_id
            WHERE s.site_id = ? AND s.status = 'completed' AND p.normalized_url = ?
          `);
          let latestMaxId: number | null = null;
          for (const candidate of lookupCandidates) {
            const row = latestSnapQuery.get(currentSiteId, candidate) as { maxId: number | null };
            if (row?.maxId && (!latestMaxId || row.maxId > latestMaxId)) {
              latestMaxId = row.maxId;
            }
          }

          inlinks = inlinksCount.count;
          outlinks = outlinksCount.count;
          latestSnapshotIdForPage = latestMaxId ?? undefined;
        }

        // Health assessment
        const criticalCount = (page.status >= 400 || page.status === 0 || page.title.status === 'missing' || page.h1.status === 'critical') ? 1 : 0;
        const warningCount = (page.title.status === 'too_long' || page.title.status === 'too_short' || page.content.wordCount < 300 || page.h1.status === 'warning') ? 1 : 0;

        res.json({
          latestSnapshotIdForPage,
          identity: {
            url: page.url,
            status: page.status,
            canonical: page.meta.canonical,
            title: page.title,
            metaDescription: page.metaDescription,
            h1: page.h1,
            crawlError: page.meta.crawlStatus === 'failed' ? 'fetch_error' : null,
            crawlDate: result.crawledAt
          },
          metrics: {
            pageRank: dbPage?.pagerank_score || 0,
            authority: dbPage?.auth_score || 0,
            hub: dbPage?.hub_score || 0,
            depth: dbPage?.depth || 0,
            inlinks,
            outlinks
          },
          health: {
            status: page.seoScore > 80 ? 'Good' : page.seoScore > 50 ? 'Warning' : 'Critical',
            criticalCount,
            warningCount,
            isThinContent: page.thinScore > 70,
            isDuplicate: page.title.status === 'duplicate',
            indexabilityRisk: !!page.meta.noindex
          },
          content: page.content,
          images: page.images,
          links: page.links,
          structuredData: page.structuredData,
          headingData: dbPage?.heading_data ? JSON.parse(dbPage.heading_data) : null,
          snapshotId: targetSnapshotId
        });
      } catch (error: any) {
        return res.status(404).json({ error: error.message || 'Page not found' });
      }
    });


    // 5.2 GET /api/page/inlinks
    api.get('/page/inlinks', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const currentSiteId = (req as any).siteId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const url = req.query.url as string;
      const pageNum = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '50', 10);
      const offset = (pageNum - 1) * pageSize;

      if (!url) return res.status(400).json({ error: 'URL is required' });
      const page = resolvePage(currentSiteId, currentSiteOrigin, url) as { id: number } | null;
      if (!page) return res.status(404).json({ error: 'Page not found' });

      const total = db.prepare(`
        SELECT COUNT(*) as count
        FROM edges
        WHERE snapshot_id = ? AND target_page_id = ? AND rel = 'internal'
      `).get(currentSnapshotId, page.id) as { count: number };

      const rows = db.prepare(`
        SELECT
          p.normalized_url as sourceUrl,
          m.pagerank_score as sourcePageRank,
          e.rel as linkType,
          'Follow' as followState -- Needs column in edges if we distinguish nofollow per link
        FROM edges e
        JOIN pages p ON e.source_page_id = p.id
        LEFT JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
        WHERE e.snapshot_id = ? AND e.target_page_id = ? AND e.rel = 'internal'
        ORDER BY m.pagerank_score DESC
        LIMIT ? OFFSET ?
      `).all(currentSnapshotId, currentSnapshotId, page.id, pageSize, offset);

      res.json({
        total: total.count,
        page: pageNum,
        pageSize,
        results: rows
      });
    });

    // 5.3 GET /api/page/outlinks
    api.get('/page/outlinks', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const currentSiteId = (req as any).siteId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const url = req.query.url as string;
      const pageNum = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '50', 10);
      const offset = (pageNum - 1) * pageSize;

      if (!url) return res.status(400).json({ error: 'URL is required' });
      const page = resolvePage(currentSiteId, currentSiteOrigin, url) as { id: number } | null;
      if (!page) return res.status(404).json({ error: 'Page not found' });

      const total = db.prepare(`
        SELECT COUNT(*) as count
        FROM edges
        WHERE snapshot_id = ? AND source_page_id = ?
      `).get(currentSnapshotId, page.id) as { count: number };

      const rows = db.prepare(`
        SELECT
          p.normalized_url as targetUrl,
          p.http_status as status,
          e.rel as type,
          CASE WHEN e.rel = 'nofollow' THEN 0 ELSE 1 END as follow
        FROM edges e
        JOIN pages p ON e.target_page_id = p.id
        WHERE e.snapshot_id = ? AND e.source_page_id = ?
        ORDER BY p.http_status DESC
        LIMIT ? OFFSET ?
      `).all(currentSnapshotId, page.id, pageSize, offset);

      res.json({
        total: total.count,
        page: pageNum,
        pageSize,
        results: rows
      });
    });

    // 5.4 GET /api/page/cluster
    api.get('/page/cluster', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const currentSiteId = (req as any).siteId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const url = req.query.url as string;

      if (!url) return res.status(400).json({ error: 'URL is required' });
      const pageMatch = resolvePage(currentSiteId, currentSiteOrigin, url);
      if (!pageMatch) return res.status(404).json({ error: 'Page not found' });

      const page = db.prepare(`
        SELECT p.id, m.duplicate_cluster_id
        FROM pages p
        JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
        WHERE p.site_id = ? AND p.id = ?
      `).get(currentSnapshotId, currentSiteId, pageMatch.id) as any;

      if (!page || !page.duplicate_cluster_id) {
        return res.json({ hasCluster: false });
      }

      const cluster = db.prepare(`
        SELECT * FROM duplicate_clusters WHERE snapshot_id = ? AND id = ?
      `).get(currentSnapshotId, page.duplicate_cluster_id) as any;

      const similarPages = db.prepare(`
        SELECT p.normalized_url
        FROM metrics m
        JOIN pages p ON m.page_id = p.id
        WHERE m.snapshot_id = ? AND m.duplicate_cluster_id = ? AND p.id != ?
        LIMIT 10
      `).all(currentSnapshotId, page.duplicate_cluster_id, page.id);

      res.json({
        hasCluster: true,
        clusterSize: cluster.size,
        representative: cluster.representative,
        similarity: 'High', // Simplified
        similarUrls: similarPages.map((r: any) => r.normalized_url)
      });
    });

    // 5.5 GET /api/page/technical
    api.get('/page/technical', validateSnapshot, (req, res) => {
      const currentSiteId = (req as any).siteId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const url = req.query.url as string;

      if (!url) return res.status(400).json({ error: 'URL is required' });
      const page = resolvePage(currentSiteId, currentSiteOrigin, url);

      if (!page) return res.status(404).json({ error: 'Page not found' });

      res.json({
        redirectChain: page.redirect_chain ? JSON.parse(page.redirect_chain) : null,
        headers: [], // Not stored in DB currently
        responseTime: null, // Not stored
        contentType: 'text/html',
        contentSize: page.bytes_received,
        serverError: page.http_status >= 500,
        status: page.http_status
      });
    });

    // 5.6 GET /api/page/graph-context
    api.get('/page/graph-context', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const currentSiteId = (req as any).siteId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const url = req.query.url as string;

      if (!url) return res.status(400).json({ error: 'URL is required' });
      const pageMatch = resolvePage(currentSiteId, currentSiteOrigin, url);
      if (!pageMatch) return res.status(404).json({ error: 'Page not found' });

      const page = db.prepare(`
        SELECT p.id, m.pagerank_score
        FROM pages p
        LEFT JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
        WHERE p.site_id = ? AND p.id = ?
      `).get(currentSnapshotId, currentSiteId, pageMatch.id) as any;

      // Get neighbors (depth 1)
      const incoming = db.prepare(`
        SELECT p.normalized_url, m.pagerank_score
        FROM edges e
        JOIN pages p ON e.source_page_id = p.id
        LEFT JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
        WHERE e.snapshot_id = ? AND e.target_page_id = ? AND e.rel = 'internal'
        LIMIT 10
      `).all(currentSnapshotId, currentSnapshotId, page.id);

      const outgoing = db.prepare(`
        SELECT p.normalized_url, m.pagerank_score
        FROM edges e
        JOIN pages p ON e.target_page_id = p.id
        LEFT JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
        WHERE e.snapshot_id = ? AND e.source_page_id = ? AND e.rel = 'internal'
        LIMIT 10
      `).all(currentSnapshotId, currentSnapshotId, page.id);

      res.json({
        centrality: page.pagerank_score,
        incoming: incoming,
        outgoing: outgoing,
        // Calculate a simple "equity ratio"
        equityRatio: incoming.length > 0 ? (outgoing.length / incoming.length) : 0
      });
    });

    // 5.7 GET /api/page/plugins
    api.get('/page/plugins', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const currentSiteId = (req as any).siteId as number;
      const currentSiteOrigin = (req as any).siteOrigin as string;
      const url = req.query.url as string;

      if (!url) return res.status(400).json({ error: 'URL is required' });

      const page = resolvePage(currentSiteId, currentSiteOrigin, url);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      const pageId = page.id;

      const migrations = db.prepare('SELECT plugin_name FROM plugin_migrations').all() as any[];
      const pluginData: Record<string, any> = {};

      for (const migration of migrations) {
        const pName = migration.plugin_name;
        const tableName = `${pName.replace(/-/g, '_')}_plugin`;
        try {
          // Check if table exists
          const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
          if (tableExists) {
            const row = db.prepare(`SELECT * FROM ${tableName} WHERE snapshot_id = ? AND url_id = ? ORDER BY created_at DESC LIMIT 1`).get(currentSnapshotId, pageId);
            if (row) {
              const parsedRow: Record<string, any> = { ...row };
              for (const key in parsedRow) {
                if (typeof parsedRow[key] === 'string' && (parsedRow[key].startsWith('{') || parsedRow[key].startsWith('['))) {
                  try {
                    parsedRow[key] = JSON.parse(parsedRow[key] as string);
                  } catch (_parseErr) {
                    // Ignore JSON parse errors for non-JSON strings
                  }
                }
              }
              pluginData[pName] = parsedRow;
            }
          }
        } catch (_e) {
          // Ignore table lookup or access errors for plugins that failed to initialize fully
        }
      }

      res.json(pluginData);
    });

    // 5.8 POST /api/page/crawl (Live crawl of single page)
    api.post('/page/crawl', express.json(), strictRateLimiter, async (req, res) => {
      const selectedSite = resolveRequestedSite(req);
      if (!selectedSite) return res.status(404).json({ error: 'Site not found' });
      const selectedSiteOrigin = UrlUtil.resolveSiteOrigin(selectedSite);
      let { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });
      url = UrlUtil.toAbsolute(url, selectedSiteOrigin);

      try {
        console.log(chalk.cyan(`   Live crawl requested: ${url}`));
        const start = Date.now();

        // Use the same PageAnalysisUseCase as CLI's `page --live`
        const useCase = new PageAnalysisUseCase({
          emit: (event: any) => {
            if (event.type === 'info' && event.message.includes('[analyze]')) {
              console.log(chalk.gray(`      ${event.message}`));
            }
          }
        });

        const result = await useCase.execute({
          url,
          live: true,
          seo: true,
          content: true,
          accessibility: true,
          plugins: options.plugins
        });

        console.log(chalk.green(`   ✅ Live crawl completed in ${Date.now() - start}ms`));

        res.json({
          success: true,
          snapshotId: result.snapshotId,
          message: 'Live crawl completed successfully'
        });
      } catch (error: any) {
        console.error(chalk.red(`❌ Live crawl failed: ${error.message}`));
        res.status(500).json({ error: error.message });
      }
    });

    // 4.8 GET /api/history (List of snapshots with key stats)
    api.get('/history', (req, res) => {
      const selectedSite = resolveRequestedSite(req);
      if (!selectedSite) return res.status(404).json({ error: 'Site not found' });
      const includeSingle = req.query.includeSingle === 'true' || req.query.includeSingle === '1';
      // Fetch snapshots with summary data from the snapshots table.
      // Note: Some stats might be null if not computed, but usually they are present.
      const sql = `
        SELECT
          id,
          run_type as type,
          created_at as createdAt,
          node_count as pages,
          health_score as health,
          orphan_count as orphanPages,
          thin_content_count as thinContent
        FROM snapshots
        WHERE site_id = ? ${includeSingle ? '' : 'AND run_type != \'single\''}
        ORDER BY created_at DESC
      `;
      const snapshots = db.prepare(sql).all(selectedSite.id);
      res.json({ results: snapshots });
    });

    // 4.9 GET /api/history/trends
    api.get('/history/trends', (req, res) => {
      const selectedSite = resolveRequestedSite(req);
      if (!selectedSite) return res.status(404).json({ error: 'Site not found' });
      const includeSingle = req.query.includeSingle === 'true' || req.query.includeSingle === '1';
      // Return a time-series list of snapshots with key metrics.
      // We'll need to aggregate metrics if they aren't fully in the snapshots table.
      // For performance, we'll join snapshots with aggregates from metrics/pages if needed.
      // But for now, let's rely on what we have in snapshots table + some fast aggregates.
      // Actually, 'broken links' is not in snapshots table directly. We need to count.

      const snapshots = db.prepare(`
        SELECT id, run_type as type, created_at, node_count, health_score, orphan_count
        FROM snapshots
        WHERE site_id = ? ${includeSingle ? '' : 'AND run_type != \'single\''}
        ORDER BY created_at ASC
      `).all(selectedSite.id) as any[];

      // Enrich with broken links count for each snapshot (expensive if many snapshots, but tolerable for < 100)
      // Optimization: One query to group by snapshot_id
      const brokenLinksCounts = db.prepare(`
        SELECT m.snapshot_id, COUNT(*) as count
        FROM metrics m
        JOIN pages p ON m.page_id = p.id
        WHERE p.site_id = ? AND (
           p.http_status >= 400 OR
           (p.http_status = 0 AND m.crawl_status IN ('network_error', 'failed_after_retries', 'fetched_error')) OR
           p.security_error IS NOT NULL
        )
        GROUP BY m.snapshot_id
      `).all(selectedSite.id) as any[];

      const brokenMap = new Map(brokenLinksCounts.map(r => [r.snapshot_id, r.count]));

      const duplicateClustersCounts = db.prepare(`
        SELECT snapshot_id, COUNT(*) as count FROM duplicate_clusters GROUP BY snapshot_id
      `).all() as any[];

      const dupMap = new Map(duplicateClustersCounts.map(r => [r.snapshot_id, r.count]));

      const trends = snapshots.map(snap => ({
        id: snap.id,
        date: snap.created_at,
        pages: snap.node_count,
        health: snap.health_score,
        orphans: snap.orphan_count || 0,
        brokenLinks: brokenMap.get(snap.id) || 0,
        duplicateClusters: dupMap.get(snap.id) || 0
      }));

      res.json({ results: trends });
    });

    // 4.10 GET /api/history/compare
    api.get('/history/compare', (req, res) => {
      const selectedSite = resolveRequestedSite(req);
      if (!selectedSite) return res.status(404).json({ error: 'Site not found' });
      const { snapshotA, snapshotB } = req.query;

      if (!snapshotA || !snapshotB) {
        return res.status(400).json({ error: 'snapshotA and snapshotB are required' });
      }

      const idA = parseInt(snapshotA as string, 10);
      const idB = parseInt(snapshotB as string, 10);

      // Verify ownership
      const snapA = snapshotRepo.getSnapshot(idA);
      const snapB = snapshotRepo.getSnapshot(idB);

      if (!snapA || snapA.site_id !== selectedSite.id || !snapB || snapB.site_id !== selectedSite.id) {
        return res.status(404).json({ error: 'Snapshots not found' });
      }

      // 1. Pages Added (Present in B, not in A) - Check by URL
      const addedPagesCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM pages pB
        JOIN metrics mB ON pB.id = mB.page_id AND mB.snapshot_id = ?
        WHERE NOT EXISTS (
          SELECT 1 FROM pages pA
          JOIN metrics mA ON pA.id = mA.page_id AND mA.snapshot_id = ?
          WHERE pA.normalized_url = pB.normalized_url
        )
      `).get(idB, idA) as { count: number };

      // 2. Pages Removed (Present in A, not in B)
      const removedPagesCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM pages pA
        JOIN metrics mA ON pA.id = mA.page_id AND mA.snapshot_id = ?
        WHERE NOT EXISTS (
          SELECT 1 FROM pages pB
          JOIN metrics mB ON pB.id = mB.page_id AND mB.snapshot_id = ?
          WHERE pB.normalized_url = pA.normalized_url
        )
      `).get(idA, idB) as { count: number };

      // 3. New Issues (Broken links in B that were OK or non-existent in A)
      // "Broken" def: status >= 400 OR network error
      const newBrokenLinks = db.prepare(`
        SELECT pB.normalized_url
        FROM pages pB
        JOIN metrics mB ON pB.id = mB.page_id AND mB.snapshot_id = ?
        WHERE (pB.http_status >= 400 OR mB.crawl_status IN ('network_error', 'fetched_error'))
        AND NOT EXISTS (
          SELECT 1 FROM pages pA
          JOIN metrics mA ON pA.id = mA.page_id AND mA.snapshot_id = ?
          WHERE pA.normalized_url = pB.normalized_url
          AND (pA.http_status >= 400 OR mA.crawl_status IN ('network_error', 'fetched_error'))
        )
        LIMIT 50
      `).all(idB, idA) as any[];

      // 4. Resolved Issues (Broken in A, OK in B)
      const resolvedBrokenLinks = db.prepare(`
        SELECT pA.normalized_url
        FROM pages pA
        JOIN metrics mA ON pA.id = mA.page_id AND mA.snapshot_id = ?
        WHERE (pA.http_status >= 400 OR mA.crawl_status IN ('network_error', 'fetched_error'))
        AND EXISTS (
          SELECT 1 FROM pages pB
          JOIN metrics mB ON pB.id = mB.page_id AND mB.snapshot_id = ?
          WHERE pB.normalized_url = pA.normalized_url
          AND (pB.http_status >= 200 AND pB.http_status < 400 AND mB.crawl_status = 'fetched')
        )
        LIMIT 50
      `).all(idA, idB) as any[];

      // Health Delta
      const healthDelta = (snapB.health_score || 0) - (snapA.health_score || 0);

      res.json({
        snapshotA: { id: idA, date: snapA.created_at, health: snapA.health_score, pages: snapA.node_count },
        snapshotB: { id: idB, date: snapB.created_at, health: snapB.health_score, pages: snapB.node_count },
        diff: {
          pagesAdded: addedPagesCount.count,
          pagesRemoved: removedPagesCount.count,
          healthDelta,
          newIssues: {
            brokenLinks: newBrokenLinks
          },
          resolvedIssues: {
            brokenLinks: resolvedBrokenLinks
          }
        }
      });
    });

    // 4.11 DELETE /api/history/:id
    api.delete('/history/:id', (req, res) => {
      const selectedSite = resolveRequestedSite(req);
      if (!selectedSite) return res.status(404).json({ error: 'Site not found' });
      const id = parseInt(req.params.id, 10);
      const snap = snapshotRepo.getSnapshot(id);

      if (!snap || snap.site_id !== selectedSite.id) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }

      // Check if it's the ONLY snapshot
      if (snapshotRepo.getSnapshotCount(selectedSite.id) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only snapshot.' });
      }

      try {
        snapshotRepo.deleteSnapshot(id);
        res.json({ success: true });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to delete snapshot' });
      }
    });

    app.use(API_PREFIX, api);


    // Serve static files
    app.use(express.static(resolvedStaticPath));

    // SPA fallback
    // SPA fallback
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(resolvedStaticPath, 'index.html'));
    });

    const server = app.listen(port, host, () => {
      const displayHost = host === '0.0.0.0' ? 'localhost' : host;
      console.log(chalk.green(`\n✅ Crawlith UI Server started at http://${displayHost}:${port}`));
      console.log(chalk.gray(`   API ready at http://${displayHost}:${port}${API_PREFIX}`));
      resolve();
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(chalk.red(`❌ Port ${port} is busy or already in use.`));
        console.error(chalk.yellow(`   Please try a different port using --port <number> or kill the process using the port.`));
        reject(err);
      } else {
        reject(err);
      }
    });

    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(chalk.yellow('\nShutting down server...'));
      server.close(() => {
        closeDb();
        console.log(chalk.green('Server stopped.'));
        process.off('SIGINT', shutdown);
        process.off('SIGTERM', shutdown);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
