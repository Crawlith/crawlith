import { getDb } from '../db/index.js';
import { loadGraphFromSnapshot } from '../db/graphLoader.js';
import { MetricsRepository } from '../db/repositories/MetricsRepository.js';
import { SnapshotRepository } from '../db/repositories/SnapshotRepository.js';
import { PageRepository } from '../db/repositories/PageRepository.js';
import { calculateMetrics } from '../graph/metrics.js';
import { EngineContext } from '../events.js';
import { Graph } from '../graph/graph.js';


import { PageRankService } from '../graph/pagerank.js';
import { HITSService } from '../graph/hits.js';
import { TrapDetector } from './trap.js';
import { ClusteringService } from '../analysis/clustering.js';
import { DuplicateService } from '../analysis/duplicate.js';
import { annotateOrphans } from '../analysis/orphan.js';
import { Soft404Service } from '../analysis/soft404.js';
import { HeadingHealthService } from '../analysis/heading.js';
import { HealthService } from '../scoring/health.js';
import { analyzeContent } from '../analysis/content.js';
import { load } from 'cheerio';

export interface PostCrawlOptions {
    context?: EngineContext;
    limitReached?: boolean;
    graphInstance?: Graph;
    clustering?: boolean;
    clusterThreshold?: number;
    minClusterSize?: number;
    health?: boolean;
    computePagerank?: boolean;
    computeHits?: boolean;
    heading?: boolean;
    orphans?: boolean;
    orphanSeverity?: 'low' | 'medium' | 'high' | boolean;
    includeSoftOrphans?: boolean;
    minInbound?: number;
    rootOrigin?: string;
}

export function runPostCrawlMetrics(snapshotId: number, maxDepth: number, options: PostCrawlOptions = {}): { metrics: any; healthData?: any } | undefined {
    const context = options.context;
    const limitReached = options.limitReached || false;
    const graphInstance = options.graphInstance;
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
        return undefined;
    }

    if (!graphInstance) {
        emit({ type: 'metrics:start', phase: 'Loading graph' });
    }




    emit({ type: 'metrics:start', phase: 'Running core algorithms' });

    // 1. Graph Algorithms
    const prResults = options.computePagerank ? new PageRankService().evaluate(graph) : new Map();
    const hitsResults = options.computeHits ? new HITSService().evaluate(graph, { iterations: 20 }) : new Map();

    // 2. Crawler Safety
    new TrapDetector().analyze(graph);

    // 3. Analysis / Intelligence
    if (options.clustering) {
        const contentClusters = new ClusteringService().detectContentClusters(graph, options.clusterThreshold, options.minClusterSize);
        if (contentClusters.length > 0) {
            const insertCluster = db.prepare(`
                INSERT OR REPLACE INTO content_clusters (id, snapshot_id, count, primary_url, risk, shared_path_prefix)
                VALUES (@id, @snapshot_id, @count, @primary_url, @risk, @shared_path_prefix)
            `);
            const insertContentTx = db.transaction((clusters: any[]) => {
                for (const c of clusters) {
                    insertCluster.run({
                        id: c.id,
                        snapshot_id: snapshotId,
                        count: c.count,
                        primary_url: c.primaryUrl,
                        risk: c.risk,
                        shared_path_prefix: c.sharedPathPrefix ?? null
                    });
                }
            });
            insertContentTx(contentClusters);
        }
    }
    const duplicateClusters = new DuplicateService().detectDuplicates(graph, { collapse: false });
    if (duplicateClusters.length > 0) {
        const insertCluster = db.prepare(`
            INSERT OR REPLACE INTO duplicate_clusters (id, snapshot_id, type, size, representative, severity)
            VALUES (@id, @snapshot_id, @type, @size, @representative, @severity)
        `);
        const insertDuplicateTx = db.transaction((clusters: any[]) => {
            for (const c of clusters) {
                insertCluster.run({
                    id: c.id,
                    snapshot_id: snapshotId,
                    type: c.type, // valid: 'exact' | 'near' | 'template_heavy'
                    size: c.size,
                    representative: c.representative,
                    severity: c.severity || 'low'
                });
            }
        });
        insertDuplicateTx(duplicateClusters);
    }

    let annotatedNodes: any[] = [];
    if (options.orphans) {
        const orphanOptions = {
            enabled: true,
            severityEnabled: !!options.orphanSeverity || options.orphanSeverity === undefined,
            includeSoftOrphans: options.includeSoftOrphans ?? true,
            minInbound: options.minInbound ?? 2
        };
        annotatedNodes = annotateOrphans(graph, orphanOptions) as any[];
    }

    const soft404Service = new Soft404Service();
    const headingService = new HeadingHealthService();
    // Pre-calculate heading health for all nodes with HTML
    let headingPayloads = new Map();
    if (options.heading) {
        const result = headingService.evaluateNodes(graph.getNodes());
        headingPayloads = result.payloadsByUrl;
    }

    // Apply signals to nodes
    for (const node of graph.getNodes()) {
        const pr = prResults.get(node.url);
        if (pr) node.pagerankScore = pr.score;

        const hits = hitsResults.get(node.url);
        if (hits) {
            node.authScore = hits.authority_score;
            node.hubScore = hits.hub_score;
            node.linkRole = hits.link_role;
        }

        if (options.orphans) {
            const annotated = annotatedNodes.find((n: any) => n.url === node.url);
            if (annotated) {
                node.orphanScore = annotated.orphanSeverity;
                node.orphanType = annotated.orphanType;
                node.impactLevel = annotated.impactLevel;
            }
        }

        if (options.heading) {
            const heading = headingPayloads.get(node.url);
            if (heading) {
                node.headingScore = heading.score;
                node.headingData = JSON.stringify(heading);
            }
        }

        if (node.html) {
            const soft404 = soft404Service.analyze(node.html, node.outLinks);
            node.soft404Score = soft404.score;

            const $ = load(node.html);
            const content = analyzeContent($);
            node.wordCount = content.wordCount;
        }
    }

    emit({ type: 'metrics:start', phase: 'Updating metrics in DB' });

    // Pre-fetch all page IDs to avoid N+1 queries
    const pagesIdentity = pageRepo.getPagesIdentityBySnapshot(snapshotId);
    const urlToId = new Map<string, number>();
    for (const p of pagesIdentity) {
        urlToId.set(p.normalized_url, p.id);
    }

    const metricsToSave = graph.getNodes().map(node => {
        const pageId = urlToId.get(node.url);
        if (!pageId) return null;

        return {
            snapshot_id: snapshotId,
            page_id: pageId,
            crawl_status: node.crawlStatus ?? null,
            word_count: node.wordCount ?? null,
            thin_content_score: node.thinContentScore ?? null,
            external_link_ratio: node.externalLinkRatio ?? null,
            pagerank_score: node.pagerankScore ?? null,
            hub_score: node.hubScore ?? null,
            auth_score: node.authScore ?? null,
            link_role: node.linkRole ?? null,
            duplicate_cluster_id: (node as any).duplicateClusterId ?? null,
            duplicate_type: (node as any).duplicateType ?? null,
            cluster_id: (node as any).clusterId ?? null,
            soft404_score: node.soft404Score ?? null,
            heading_score: node.headingScore ?? null,
            orphan_score: node.orphanScore ?? null,
            orphan_type: node.orphanType ?? null,
            impact_level: node.impactLevel ?? null,
            heading_data: node.headingData ?? null,
            is_cluster_primary: (node as any).isClusterPrimary ? 1 : 0
        };
    }).filter(m => m !== null);

    metricsRepo.insertMany(metricsToSave as any);

    // Update page-level metadata in transaction
    const tx = db.transaction(() => {
        for (const node of graph.getNodes()) {
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

    // Compute health score if enabled
    let healthScore: number | null = null;
    if (options.health) {
        try {
            const rootOrigin = options.rootOrigin ?? '';
            const healthService = new HealthService();
            const issues = healthService.collectCrawlIssues(graph, metrics, rootOrigin);
            const breakdown = healthService.calculateHealthScore(metrics.totalPages, issues);
            healthScore = breakdown.score;
        } catch (e) {
            emit({ type: 'error', message: 'Error computing health score', error: e });
        }
    }

    const thinContentCount = graph.getNodes().filter(n => n.wordCount !== undefined && n.wordCount < 200 && n.status === 200).length;
    const orphanCount = metrics.orphanPages.length;

    snapshotRepo.updateSnapshotStatus(snapshotId, 'completed', {
        node_count: metrics.totalPages,
        edge_count: metrics.totalEdges,
        limit_reached: limitReached ? 1 : 0,
        thin_content_count: thinContentCount,
        orphan_count: orphanCount,
        ...(healthScore !== null ? { health_score: healthScore } : {})
    });

    emit({ type: 'metrics:complete', durationMs: 0 });

    return { 
        metrics,
        healthData: healthScore !== null ? { 
            health: new HealthService().calculateHealthScore(metrics.totalPages, new HealthService().collectCrawlIssues(graph, metrics, options.rootOrigin ?? '')),
            issues: new HealthService().collectCrawlIssues(graph, metrics, options.rootOrigin ?? '')
        } : undefined
    };
}
