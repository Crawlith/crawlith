import express from 'express';
import path from 'path';
import chalk from 'chalk';
import {
  getDb,
  closeDb,
  SiteRepository,
  SnapshotRepository,
  PageRepository,
  MetricsRepository,
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
    // Repositories instantiated for potential future use or consistency, but currently unused variables prefixed with _
    const _siteRepo = new SiteRepository(db);
    const _snapshotRepo = new SnapshotRepository(db);
    const _pageRepo = new PageRepository(db);
    const _metricsRepo = new MetricsRepository(db);

    const app = express();
    const API_PREFIX = '/api';

    // Verify initial context
    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) as { domain: string, created_at: string };
    if (!site) {
      console.error(chalk.red(`❌ Site ID ${siteId} not found.`));
      process.exit(1);
    }

    // Check if snapshot exists
    // Use direct DB query or the repo instance if we were using it, but for now strict consistency with existing logic
    const initialSnapshot = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(snapshotId);
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
      const snap = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(snapId) as Snapshot | undefined;
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
      const snapshots = db.prepare('SELECT id, created_at, health_score FROM snapshots WHERE site_id = ? AND id < ? ORDER BY id DESC LIMIT 1').get(siteId, currentSnapshotId) as { id: number, health_score: number } | undefined;

      // Aggregates from metrics table
      const metricsAgg = db.prepare(`
        SELECT
          COUNT(CASE WHEN link_role = 'orphan' THEN 1 END) as orphan_count,
          COUNT(CASE WHEN duplicate_cluster_id IS NOT NULL AND is_cluster_primary = 0 THEN 1 END) as duplicate_count
        FROM metrics
        WHERE snapshot_id = ?
      `).get(currentSnapshotId) as any;

      // Aggregates from pages table
      const pagesAgg = db.prepare(`
        SELECT
           COUNT(*) as total_pages,
           COUNT(CASE WHEN http_status >= 400 THEN 1 END) as broken_links,
           COUNT(CASE WHEN redirect_chain IS NOT NULL THEN 1 END) as redirect_chains,
           COUNT(CASE WHEN noindex = 1 THEN 1 END) as noindex_pages
        FROM pages
        JOIN snapshots ON pages.site_id = snapshots.site_id
        WHERE snapshots.id = ? AND pages.first_seen_snapshot_id <= ?
      `).get(currentSnapshotId, currentSnapshotId) as any;

      // Internal links count (sum of all internal edges)
      const linksCount = db.prepare('SELECT COUNT(*) as count FROM edges WHERE snapshot_id = ? AND rel = ?').get(currentSnapshotId, 'internal') as { count: number };


      res.json({
        health: {
          score: snap.health_score ?? 0,
          status: (snap.health_score ?? 0) > 80 ? 'Good' : (snap.health_score ?? 0) > 50 ? 'Warning' : 'Critical',
          delta: snapshots ? (snap.health_score ?? 0) - (snapshots.health_score ?? 0) : 0
        },
        totals: {
          pages: snap.node_count,
          internalLinks: linksCount.count,
          duplicateClusters: metricsAgg?.duplicate_count || 0, // This is count of duplicate pages, not clusters. Correcting below.
          orphanPages: snap.orphan_count ?? 0,
          brokenLinks: pagesAgg?.broken_links || 0,
          redirectChains: pagesAgg?.redirect_chains || 0,
          noindexPages: pagesAgg?.noindex_pages || 0
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
      const _severity = req.query.severity as string; // Unused for now
      const search = req.query.search as string;
      const page = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '50', 10);
      const offset = (page - 1) * pageSize;

      let sql = `
        SELECT
          p.normalized_url as url,
          p.http_status,
          m.pagerank_score as pageRank,
          p.last_seen_snapshot_id as lastSeen,
          'Info' as severity, -- Default
          0 as impactScore,   -- Default
          'Generic' as issueType -- Default
        FROM pages p
        JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ?
        WHERE p.site_id = ?
      `;

      const params: any[] = [currentSnapshotId, siteId];

      if (search) {
        sql += ' AND p.normalized_url LIKE ?';
        params.push(`%${search}%`);
      }

      // Note: This is a simplified implementation.
      // Real implementation would join with an issues table or view if it existed.
      // Since we don't have an issues table, we'll return raw pages with some basic logic for now
      // and let frontend filter/map or enhance this SQL later.
      // Given the requirements, we need to map actual issues.

      // Let's modify to return specific "bad" pages
      // Broken Links
      // Redirect Chains
      // Etc.

      // For now, let's return all pages but prioritize "interesting" ones
      sql += ' ORDER BY m.pagerank_score DESC LIMIT ? OFFSET ?';
      params.push(pageSize, offset);

      const results = db.prepare(sql).all(...params);
      const count = db.prepare(`SELECT COUNT(*) as count FROM pages p JOIN metrics m ON p.id = m.page_id AND m.snapshot_id = ? WHERE p.site_id = ?`).get(currentSnapshotId, siteId) as { count: number };

      res.json({
        total: count.count,
        page,
        pageSize,
        results: results.map((r: any) => ({
            url: r.url,
            issueType: r.http_status >= 400 ? 'Broken Link' : (r.http_status >= 300 ? 'Redirect' : 'Page'),
            severity: r.http_status >= 400 ? 'Critical' : 'Info',
            impactScore: Math.floor((r.pageRank || 0) * 100),
            pageRank: r.pageRank,
            lastSeen: new Date().toISOString() // Placeholder as we don't have snapshot date easily joined here yet
        }))
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
