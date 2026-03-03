import { getDb } from '../db/index.js';
import { loadGraphFromSnapshot } from '../db/graphLoader.js';
import { MetricsRepository } from '../db/repositories/MetricsRepository.js';
import { SnapshotRepository } from '../db/repositories/SnapshotRepository.js';
import { PageRepository } from '../db/repositories/PageRepository.js';
import { calculateMetrics } from '../graph/metrics.js';
import { EngineContext } from '../events.js';
import { Graph } from '../graph/graph.js';

export interface PostCrawlMetricOptions {
}

export function runPostCrawlMetrics(snapshotId: number, maxDepth: number, context?: EngineContext, limitReached: boolean = false, graphInstance?: Graph, options: PostCrawlMetricOptions = {}) {
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
            else if (event.type !== 'debug') {
                const out = event.message || event.phase;
                if (out) console.log(out);
            }
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




    emit({ type: 'metrics:start', phase: 'Updating metrics in DB' });
    const nodes = graph.getNodes();

    // Pre-fetch all page IDs to avoid N+1 queries
    // Use getPagesIdentityBySnapshot to avoid loading full page content (HTML) into memory again
    const pages = pageRepo.getPagesIdentityBySnapshot(snapshotId);
    const urlToId = new Map<string, number>();
    for (const p of pages) {
        urlToId.set(p.normalized_url, p.id);
    }



    const tx = db.transaction(() => {
        for (const node of nodes) {
            const pageId = urlToId.get(node.url);
            if (!pageId) continue;


            metricsRepo.insertMetrics({
                snapshot_id: snapshotId,
                page_id: pageId,

                crawl_status: node.crawlStatus ?? null,
                word_count: node.wordCount ?? null,
                thin_content_score: node.thinContentScore ?? null,
                external_link_ratio: node.externalLinkRatio ?? null,
                orphan_score: node.orphanScore ?? null
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


    });
    tx();

    emit({ type: 'metrics:start', phase: 'Computing aggregate stats' });
    const metrics = calculateMetrics(graph, maxDepth);

    snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', {
        node_count: metrics.totalPages,
        edge_count: metrics.totalEdges,
        limit_reached: limitReached ? 1 : 0
    });

    emit({ type: 'metrics:complete', durationMs: 0 });

    return { metrics };
}
