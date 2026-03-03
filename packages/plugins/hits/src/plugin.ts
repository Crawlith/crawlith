import { PluginContext, Graph } from '@crawlith/core';
import { HITSService } from './Service.js';
import { HITSRow } from './types.js';

export const HitsHooks = {
    /**
     * Called on the fully built graph during post-crawl metrics.
     */
    onMetrics: async (ctx: PluginContext, graph: Graph) => {
        const flags = ctx.flags || {};
        if (!flags.computeHits || !ctx.db) return;

        ctx.logger?.info?.('🧮 Computing HITS Hub/Authority scores...');

        const service = new HITSService();
        const hitsResults = service.evaluate(graph);

        let count = 0;
        for (const node of graph.getNodes()) {
            const res = hitsResults.get(node.url);
            if (res) {
                // Mutate node for downstream in-memory use (core metrics might still look at these)
                (node as any).authorityScore = res.authority_score;
                (node as any).hubScore = res.hub_score;
                (node as any).linkRole = res.link_role;

                // Save to plugin scoped table
                await ctx.db.data.save({
                    url: node.url,
                    data: {
                        ...res,
                        score: res.authority_score * 100, // Normalized for aggregator (0-100 range)
                        weight: 1.0
                    }
                });
                count++;
            }
        }

        ctx.logger?.info?.(`🧮 HITS computation complete for ${count} nodes.`);
    },

    /**
     * Post-crawl reporting hook.
     */
    onReport: async (ctx: PluginContext, result: any) => {
        const flags = ctx.flags || {};
        if (!flags.computeHits || !ctx.db) return;

        const allRows = ctx.db.data.all<HITSRow & { url: string }>();
        if (allRows.length === 0) return;

        if (!result.plugins) result.plugins = {};

        // Summary metrics
        const authorities = allRows.filter(r => r.link_role === 'authority' || r.link_role === 'power');
        const hubs = allRows.filter(r => r.link_role === 'hub' || r.link_role === 'power');

        result.plugins.hits = {
            authorityCount: authorities.length,
            hubCount: hubs.length,
            topAuthorities: authorities
                .sort((a, b) => b.authority_score - a.authority_score)
                .slice(0, 10)
                .map(a => ({ url: (a as any).url, score: a.authority_score })),
            topHubs: hubs
                .sort((a, b) => b.hub_score - a.hub_score)
                .slice(0, 10)
                .map(h => ({ url: (h as any).url, score: h.hub_score }))
        };
    }
};
