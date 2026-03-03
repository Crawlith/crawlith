import { PluginContext, Graph } from '@crawlith/core';
import { PageRankService } from './Service.js';
import { PageRankRow } from './types.js';

export const PageRankHooks = {
    /**
     * Called during `crawl` execution. Analyzes the fully formed graph.
     * Caches results into SQLite natively via `ctx.db.data.getOrFetch`.
     */
    onMetrics: async (ctx: PluginContext, graph: Graph) => {
        // We only execute PageRank if there's actually a DB session connected (crawl context)
        // and if the crawler explicitly loaded the graph structure.
        if (!ctx.db) return;

        ctx.logger?.info?.('🧮 Computing Production-Grade PageRank distribution...');

        // We compute the entire graph globally once
        const service = new PageRankService();
        const rankPayloads = service.evaluate(graph);

        let evaluatedCount = 0;

        for (const node of graph.getNodes()) {
            if (!node.url) continue;

            const payload = rankPayloads.get(node.url);

            // We still update graph node natively because downstream clustering/scoring processes depend on it
            // in memory before getting into the CLI reporter.
            if (payload) {
                (node as any).pageRank = payload.raw_rank;
                (node as any).pageRankScore = payload.score;
                evaluatedCount++;

                // Cache internally against `<snapshotId>, <url_id>` into `pagerank_plugin`
                await ctx.db.data.getOrFetch<PageRankRow>(
                    node.url,
                    async () => payload
                );
            }
        }

        ctx.logger?.info?.(`🧮 PageRank distribution calculated across ${evaluatedCount} interconnected nodes.`);
    },

    /**
     * Evaluates the active snapshot results and attaches them statically mapped onto the final JSON reporter.
     */
    onReport: async (ctx: PluginContext, result: any) => {
        if (!ctx.db) return;

        // Pull directly from our scoped SQLite plugin table
        const allRows = ctx.db.data.all<{ url_id: number; raw_rank: number; score: number }>();

        if (allRows.length > 0) {
            if (!result.plugins) result.plugins = {};

            // Inject directly back to final JSON pages footprint 
            if (Array.isArray(result.pages)) {
                for (const page of result.pages) {
                    if ((page as any).pageRankScore !== undefined) {
                        // Usually already injected if doing stringification, but ensuring strict format
                        page.plugins = page.plugins || {};
                        page.plugins.pagerank = {
                            score: (page as any).pageRankScore,
                            raw_rank: (page as any).pageRank
                        };
                    }
                }
            }

            const highValueEntities = [...allRows].sort((a, b) => b.score - a.score).slice(0, 5);

            result.plugins.pagerank = {
                totalEvaluated: allRows.length,
                topEntities: highValueEntities.map(r => ({ score: r.score })) // IDs would need mapped, but raw scores work
            };
        }
    }
};
