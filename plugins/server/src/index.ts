import express from 'express';
import path from 'path';
import chalk from 'chalk';
import {
  getDb,
  closeDb,
  SiteRepository,
  SnapshotRepository,

  Snapshot
} from '@crawlith/core';

export interface ServerOptions {
  port: number;
  host?: string;
  staticPath: string;
  siteId: number;
  snapshotId: number;
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
    const site = siteRepo.getSiteById(siteId);
    if (!site) {
      console.error(chalk.red(`❌ Site ID ${siteId} not found.`));
      process.exit(1);
    }

    // Check if snapshot exists
    const initialSnapshot = snapshotRepo.getSnapshot(snapshotId);
    if (!initialSnapshot) {
      console.error(chalk.red(`❌ Snapshot ID ${snapshotId} not found.`));
      process.exit(1);
    }

    console.log(chalk.gray(`   Loaded Context: ${site.domain} (Snapshot #${snapshotId})`));


    // API Router
    const api = express.Router();

    // Middleware to validate snapshotId query param
    const validateSnapshot = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const snapId = req.query.snapshot ? parseInt(req.query.snapshot as string, 10) : snapshotId;

      // Basic validation: ensure snapshot belongs to site
      const snap = snapshotRepo.getSnapshot(snapId);
      if (!snap || snap.site_id !== siteId) {
        return res.status(404).json({ error: 'Snapshot not found or does not belong to this site' });
      }

      (req as any).snapshotId = snapId;
      (req as any).snapshot = snap;
      next();
    };

    // 4.1 GET /api/context
    api.get('/context', (req, res) => {
      res.json({
        siteId,
        snapshotId, // Default boot snapshot
        domain: site.domain,
        createdAt: site.created_at
      });
    });

    // 4.2 GET /api/overview
    api.get('/overview', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
      const snap = (req as any).snapshot as Snapshot;

      // Get previous snapshot for comparison
      const previousSnapshot = db.prepare('SELECT id, created_at, health_score FROM snapshots WHERE site_id = ? AND id < ? ORDER BY id DESC LIMIT 1').get(siteId, currentSnapshotId) as { id: number, health_score: number } | undefined;

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
           COUNT(CASE WHEN p.canonical_url IS NOT NULL AND p.canonical_url != p.normalized_url THEN 1 END) as canonical_issues,
           COUNT(CASE WHEN m.crawl_status = 'blocked_by_robots' THEN 1 END) as blocked_robots,
           COUNT(CASE WHEN p.crawl_trap_flag = 1 THEN 1 END) as crawl_traps
        FROM metrics m
        JOIN pages p ON m.page_id = p.id
        WHERE m.snapshot_id = ?
      `).get(currentSnapshotId) as any;

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
        }
      });
    });

    // 4.3 GET /api/issues
    api.get('/issues', validateSnapshot, (req, res) => {
      const currentSnapshotId = (req as any).snapshotId as number;
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
          m.pagerank as rawPageRank,
          m.pagerank_score as pageRankScore,
          m.duplicate_type,
          m.thin_content_score,
          m.word_count,
          m.link_role,
          m.crawl_status,
          p.security_error,
          s.created_at as lastSeen
        FROM pages p
        JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
        JOIN snapshots s ON m.snapshot_id = s.id
        WHERE p.site_id = ?
      `;

      const params: any[] = [currentSnapshotId, siteId];

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
        }

        return {
          url: r.url,
          issueType,
          severity: sev,
          impactScore: Math.round(impactFactor * importanceMultiplier),
          pageRank: r.rawPageRank,
          pageRankScore: r.pageRankScore,
          lastSeen: r.lastSeen,
          isProblematic
        };
      });

      // Filter: Only problematic ones by default, unless searching
      let filtered = allIssues;
      if (!search && (!severity || severity === 'All')) {
        filtered = allIssues.filter(i => i.isProblematic);
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
        SELECT p.normalized_url as url, m.pagerank_score as pageRank, m.authority_score as authorityScore, m.hub_score as hubScore
        FROM metrics m
        JOIN pages p ON m.page_id = p.id
        WHERE m.snapshot_id = ?
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

    // 4.7 GET /api/snapshots
    api.get('/snapshots', (req, res) => {
      const rows = db.prepare('SELECT id, created_at as createdAt FROM snapshots WHERE site_id = ? ORDER BY created_at DESC').all(siteId);
      res.json({ results: rows });
    });

    app.use(API_PREFIX, api);


    // Serve static files
    app.use(express.static(resolvedStaticPath));

    // SPA fallback
    app.get('*', (req, res) => {
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

    const shutdown = () => {
      console.log(chalk.yellow('\nShutting down server...'));
      closeDb();
      server.close(() => {
        console.log(chalk.green('Server stopped.'));
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
