import { getDb } from './index.js';
import { PageRepository } from './repositories/PageRepository.js';
import { EdgeRepository } from './repositories/EdgeRepository.js';
import { MetricsRepository, DbMetrics } from './repositories/MetricsRepository.js';
import { SnapshotRepository } from './repositories/SnapshotRepository.js';
import { Graph } from '../graph/graph.js';

export function loadGraphFromSnapshot(snapshotId: number): Graph {
    const db = getDb();
    const pageRepo = new PageRepository(db);
    const edgeRepo = new EdgeRepository(db);
    const metricsRepo = new MetricsRepository(db);
    const snapshotRepo = new SnapshotRepository(db);

    const pages = pageRepo.getPagesBySnapshot(snapshotId);
    const metrics = metricsRepo.getMetrics(snapshotId);
    const snapshot = snapshotRepo.getSnapshot(snapshotId);
    const metricsMap = new Map<number, DbMetrics>();
    for (const m of metrics) {
        metricsMap.set(m.page_id, m);
    }

    const graph = new Graph();
    if (snapshot) {
        graph.limitReached = !!snapshot.limit_reached;
    }
    const idMap = new Map<number, string>();

    for (const p of pages) {
        idMap.set(p.id, p.normalized_url);
        graph.addNode(p.normalized_url, p.depth, p.http_status || 0);

        const m = metricsMap.get(p.id);
        let incrementalStatus: 'new' | 'changed' | 'unchanged' | undefined;
        if (p.first_seen_snapshot_id === snapshotId) {
            incrementalStatus = 'new';
        } else if (m?.crawl_status === 'cached') {
            incrementalStatus = 'unchanged';
        } else if (m?.crawl_status === 'fetched') {
            incrementalStatus = 'changed';
        }

        graph.updateNodeData(p.normalized_url, {
            canonical: p.canonical_url || undefined,
            contentHash: p.content_hash || undefined,
            simhash: p.simhash || undefined,
            etag: p.etag || undefined,
            lastModified: p.last_modified || undefined,
            html: p.html || undefined,
            soft404Score: p.soft404_score || undefined,
            noindex: !!p.noindex,
            nofollow: !!p.nofollow,
            incrementalStatus,
            securityError: p.security_error || undefined,
            retries: p.retries || undefined,
            bytesReceived: p.bytes_received || undefined,
            redirectChain: p.redirect_chain ? JSON.parse(p.redirect_chain) : undefined,
            crawlTrapFlag: !!p.crawl_trap_flag,
            crawlTrapRisk: p.crawl_trap_risk || undefined,
            trapType: p.trap_type || undefined,
            // Metrics
            pageRank: m?.pagerank ?? undefined,
            pageRankScore: m?.pagerank_score ?? m?.pagerank ?? undefined,
            authorityScore: m?.authority_score ?? undefined,
            hubScore: m?.hub_score ?? undefined,
            linkRole: m?.link_role ?? undefined,
            // Duplicate info
            duplicateClusterId: m?.duplicate_cluster_id ?? undefined,
            duplicateType: m?.duplicate_type ?? undefined,
            isClusterPrimary: m?.is_cluster_primary ? true : undefined,
        });
    }

    const edges = edgeRepo.getEdgesBySnapshot(snapshotId);

    for (const e of edges) {
        const source = idMap.get(e.source_page_id);
        const target = idMap.get(e.target_page_id);
        if (source && target) {
            graph.addEdge(source, target, e.weight || 1.0);
        }
    }

    // Load duplicate clusters
    const dupClusters = db.prepare('SELECT * FROM duplicate_clusters WHERE snapshot_id = ?').all(snapshotId) as any[];
    graph.duplicateClusters = dupClusters.map(c => ({
        id: c.id,
        type: c.type,
        size: c.size,
        representative: c.representative,
        severity: c.severity
    }));

    // Load content clusters
    const contentClusters = db.prepare('SELECT * FROM content_clusters WHERE snapshot_id = ?').all(snapshotId) as any[];
    graph.contentClusters = contentClusters.map(c => ({
        id: c.id,
        count: c.count,
        primaryUrl: c.primary_url,
        risk: c.risk,
        sharedPathPrefix: c.shared_path_prefix || undefined
    }));

    return graph;
}
