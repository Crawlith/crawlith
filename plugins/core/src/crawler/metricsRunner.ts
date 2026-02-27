import { getDb } from '../db/index.js';
import { loadGraphFromSnapshot } from '../db/graphLoader.js';
import { MetricsRepository } from '../db/repositories/MetricsRepository.js';
import { SnapshotRepository } from '../db/repositories/SnapshotRepository.js';
import { PageRepository } from '../db/repositories/PageRepository.js';
import { computePageRank } from '../graph/pagerank.js';
import { calculateMetrics } from '../graph/metrics.js';
import { computeHITS } from '../scoring/hits.js';
import { EngineContext } from '../events.js';
import { calculateHealthScore, collectCrawlIssues } from '../scoring/health.js';

import { Graph } from '../graph/graph.js';

export function runPostCrawlMetrics(snapshotId: number, maxDepth: number, context?: EngineContext, limitReached: boolean = false, graphInstance?: Graph) {
    const db = getDb();
    const metricsRepo = new MetricsRepository(db);
    const snapshotRepo = new SnapshotRepository(db);
    const pageRepo = new PageRepository(db);

    const graph = graphInstance || loadGraphFromSnapshot(snapshotId);

    // Fallback emitter
    const emit = (event: any) => {
        if (context) {
            context.emit(event);
        } else {
            if (event.type === 'error') console.error(event.message);
            else if (event.type !== 'debug') console.log(event.message || event.phase);
        }
    };

    const snapshot = snapshotRepo.getSnapshot(snapshotId);
    if (!snapshot) {
        emit({ type: 'error', message: `Snapshot ${snapshotId} not found` });
        return;
    }

    if (!graphInstance) {
        emit({ type: 'metrics:start', phase: 'Loading graph' });
    }

    emit({ type: 'metrics:start', phase: 'Computing PageRank' });
    computePageRank(graph);

    emit({ type: 'metrics:start', phase: 'Computing HITS' });
    computeHITS(graph);

    emit({ type: 'metrics:start', phase: 'Updating metrics in DB' });
    const nodes = graph.getNodes();

    // Pre-fetch all page IDs to avoid N+1 queries
    // Use getPagesIdentityBySnapshot to avoid loading full page content (HTML) into memory again
    const pages = pageRepo.getPagesIdentityBySnapshot(snapshotId);
    const urlToId = new Map<string, number>();
    for (const p of pages) {
        urlToId.set(p.normalized_url, p.id);
    }

    const clusterStmt = db.prepare(`
        INSERT OR REPLACE INTO duplicate_clusters (id, snapshot_id, type, size, representative, severity)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const contentStmt = db.prepare(`
        INSERT OR REPLACE INTO content_clusters (id, snapshot_id, count, primary_url, risk, shared_path_prefix)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
        for (const node of nodes) {
            const pageId = urlToId.get(node.url);
            if (!pageId) continue;


            metricsRepo.insertMetrics({
                snapshot_id: snapshotId,
                page_id: pageId,
                authority_score: node.authorityScore ?? null,
                hub_score: node.hubScore ?? null,
                pagerank: node.pageRank ?? null,
                pagerank_score: node.pageRankScore ?? null,
                link_role: node.linkRole ?? null,
                crawl_status: node.crawlStatus ?? null,
                word_count: node.wordCount ?? null,
                thin_content_score: node.thinContentScore ?? null,
                external_link_ratio: node.externalLinkRatio ?? null,
                orphan_score: node.orphanScore ?? null,
                duplicate_cluster_id: node.duplicateClusterId ?? null,
                duplicate_type: node.duplicateType ?? null,
                is_cluster_primary: node.isClusterPrimary ? 1 : 0
            });

            // Update page-level crawl trap data
            if (node.crawlTrapFlag || node.redirectChain?.length || node.bytesReceived) {
                pageRepo.upsertPage({
                    site_id: snapshot.site_id,
                    normalized_url: node.url,
                    last_seen_snapshot_id: snapshotId,
                    redirect_chain: node.redirectChain ? JSON.stringify(node.redirectChain) : null,
                    bytes_received: node.bytesReceived ?? null,
                    crawl_trap_flag: node.crawlTrapFlag ? 1 : 0,
                    crawl_trap_risk: node.crawlTrapRisk ?? null,
                    trap_type: node.trapType ?? null,
                });
            }
        }

        // Save duplicate clusters
        for (const cluster of graph.duplicateClusters) {
            clusterStmt.run(cluster.id, snapshotId, cluster.type, cluster.size, cluster.representative, cluster.severity);
        }

        // Save content clusters
        for (const cluster of graph.contentClusters) {
            contentStmt.run(cluster.id, snapshotId, cluster.count, cluster.primaryUrl, cluster.risk, cluster.sharedPathPrefix ?? null);
        }
    });
    tx();

    emit({ type: 'metrics:start', phase: 'Computing aggregate stats' });
    const metrics = calculateMetrics(graph, maxDepth);

    // Calculate penalty-based health score (matches CLI)
    const issues = collectCrawlIssues(graph, metrics);
    const health = calculateHealthScore(metrics.totalPages, issues);

    snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', {
        node_count: metrics.totalPages,
        edge_count: metrics.totalEdges,
        health_score: health.score,
        orphan_count: issues.orphanPages,
        thin_content_count: issues.thinContent,
        limit_reached: limitReached ? 1 : 0
    });

    emit({ type: 'metrics:complete', durationMs: 0 });
}
