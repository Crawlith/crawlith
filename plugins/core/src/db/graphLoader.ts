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

    const pages = pageRepo.getPagesIteratorBySnapshot(snapshotId);
    const metrics = metricsRepo.getMetricsIterator(snapshotId);
    const snapshot = snapshotRepo.getSnapshot(snapshotId);
    const metricsMap = new Map<number, DbMetrics>();
    for (const m of metrics) {
        metricsMap.set(m.page_id, m);
    }

    const graph = new Graph();
    let pagesFetched = 0;
    let pagesCached = 0;
    let pagesSkipped = 0;

    if (snapshot) {
        graph.limitReached = !!snapshot.limit_reached;
    }
    const idMap = new Map<number, string>();

    for (const p of pages) {
        idMap.set(p.id, p.normalized_url);
        graph.addNode(p.normalized_url, p.depth, p.http_status || 0);

        const m = metricsMap.get(p.id);
        if (m) {
            const isProcessed = m.crawl_status === 'fetched' ||
                m.crawl_status === 'fetched_error' ||
                m.crawl_status === 'network_error' ||
                m.crawl_status === 'failed_after_retries' ||
                m.crawl_status === 'blocked_by_robots';

            if (isProcessed) pagesFetched++;
            else if (m.crawl_status === 'cached') pagesCached++;
            else if (m.crawl_status === 'skipped') pagesSkipped++;
        }

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
            // Additional metrics
            crawlStatus: m?.crawl_status || undefined,
            wordCount: m?.word_count != null ? m.word_count : undefined,
            thinContentScore: m?.thin_content_score != null ? m.thin_content_score : undefined,
            externalLinkRatio: m?.external_link_ratio != null ? m.external_link_ratio : undefined,
            orphanScore: m?.orphan_score != null ? m.orphan_score : undefined,
        });
    }

    const edges = edgeRepo.getEdgesIteratorBySnapshot(snapshotId);

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

    // Set session stats
    graph.sessionStats = {
        pagesFetched,
        pagesCached,
        pagesSkipped,
        totalFound: idMap.size
    };

    return graph;
}
