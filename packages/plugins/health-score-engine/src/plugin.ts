import { PluginContext, Graph, scorePageSeo, analyzePages } from '@crawlith/core';
import { HealthService, DEFAULT_HEALTH_WEIGHTS } from './Service.js';
import { HealthRow } from './types.js';

const service = new HealthService();

export const HealthScoreHooks = {
    /**
     * For single-page analysis, provide a basic health breakdown.
     */
    onPage: async (ctx: PluginContext, page: any) => {
        // Single page analysis doesn't have a link graph for full health score,
        // so we use the SEO scorer from core.
        const analysisResults = analyzePages(page.url, [page], undefined, { allPages: false });
        if (analysisResults.length > 0) {
            const seoScore = analysisResults[0].seoScore;
            ctx.logger?.info(`Page Health Score: ${seoScore}`);
        }
    },

    /**
     * On metrics, we compute the site-wide health score and issues.
     */
    onMetrics: async (ctx: PluginContext, graph: Graph) => {
        const metrics = (graph as any).metrics || {}; // Assume core or other plugins populated metrics

        const issues = service.collectCrawlIssues(graph, metrics);
        const health = service.calculateHealthScore(graph.nodes.size, issues, DEFAULT_HEALTH_WEIGHTS);

        // Save summary to plugin-scoped storage
        // Since this is a site-wide metric, we store it under a special key or just in the report
        ctx.metadata = ctx.metadata || {};
        ctx.metadata.healthReport = { health, issues };

        // To satisfy ScoreProvider, we should also store per-page scores if we want to contribute 
        // to the aggregate snapshots.total_score. 
        if (ctx.db) {
            const nodes = graph.getNodes();

            // Map graph nodes to PageAnalysis for scorePageSeo
            // In a real scenario, we might want to perform full analysis, but here we can
            // synthesize a PageAnalysis object from the graph node metrics.
            const results = analyzePages('', nodes.map(node => ({
                url: node.url,
                status: node.status,
                html: node.html || '',
                depth: node.depth,
                crawlStatus: node.crawlStatus
            })), undefined, { allPages: true });

            for (const analysis of results) {
                ctx.db.data.save({
                    url: analysis.url,
                    data: {
                        score: analysis.seoScore,
                        weight: 1.0
                    }
                });
            }

            // The logic for snapshots.health_score in core is global.
            // Let's update that column directly for compatibility.
            const rawDb = (ctx.db as any).unsafeGetRawDb();
            if (rawDb) {
                rawDb.prepare(`UPDATE snapshots SET health_score = ?, orphan_count = ?, thin_content_count = ? WHERE id = ?`)
                    .run(health.score, issues.orphanPages, issues.thinContent, ctx.snapshotId);
            }
        }
    },

    /**
     * Emit the health report.
     */
    onReport: async (ctx: PluginContext, result: any) => {
        const report = ctx.metadata?.healthReport;
        if (!report) return;

        result.plugins = result.plugins || {};
        result.plugins.health = report;

        const flags = ctx.flags || {};
        if (flags.scoreBreakdown) {
            ctx.logger?.info('\nHealth Score Breakdown:');
            ctx.logger?.info(`  Overall Score: ${report.health.score} (${report.health.status})`);
            ctx.logger?.info(`  Penalties: ${JSON.stringify(report.health.weightedPenalties, null, 2)}`);
        }

        if (flags.failOnCritical && report.health.score < 50) {
            ctx.logger?.error(`\n❌ Fail-on-critical: Health score ${report.health.score} is below threshold.`);
            process.exit(1);
        }
    }
};
