import { PluginContext, PageInput } from '@crawlith/core';
import { Soft404Service } from './Service.js';
import { Soft404Row } from './types.js';

export const Soft404Hooks = {
    /**
     * Called during `crawlith page` command to analyze the single page immediately.
     */
    onPage: async (ctx: PluginContext, page: PageInput) => {
        if (!ctx.flags?.detectSoft404 || !ctx.db) return;

        const service = new Soft404Service();
        // Cache the soft404 result natively inside SQLite via getOrFetch.
        const row = await ctx.db.data.getOrFetch<Soft404Row>(
            page.url,
            async () => service.analyze(page.html, 0 /* onPage command doesn't provide fully built links graph yet */)
        );

        if (row && ctx.logger) {
            if (row.score > 0) {
                ctx.logger.warn(`[soft404-detector] Score for ${page.url}: ${row.score} (${row.reason})`);
            } else {
                ctx.logger.info(`[soft404-detector] Score for ${page.url}: 0 (No issues detected)`);
            }
        }
    },

    /**
     * Called on the fully built graph when a `crawl` evaluates metrics across the snapshot.
     */
    onMetrics: async (ctx: PluginContext, graph: any) => {
        const flags = ctx.flags || {};
        if (!flags.detectSoft404 || !ctx.db) return;

        ctx.logger?.info?.('🕵️ Detecting soft 404 pages...');

        const service = new Soft404Service();
        const nodes = graph.getNodes();

        let issueCount = 0;

        for (const node of nodes) {
            if (node.status === 200) {
                // Caches internally inside 'soft404_detector_plugin' SQLite table.
                const row = await ctx.db.data.getOrFetch<Soft404Row>(
                    node.url,
                    async () => service.analyze(node.html, node.outLinks || 0)
                );

                if (row && row.score > 0) {
                    (node as any).soft404 = {
                        score: row.score,
                        reason: row.reason
                    };
                    // Map back to node so pagerank/crawlers can read it downstream.
                    node.soft404Score = row.score;
                    issueCount++;
                }
            }
        }

        if (issueCount > 0) {
            ctx.logger?.warn(`🕵️ Soft 404 detection complete. Found ${issueCount} issues!`);
        } else {
            ctx.logger?.info(`🕵️ Soft 404 detection complete.`);
        }
    },

    /**
     * Evaluates the active snapshot results and attaches them statically mapped onto the final JSON reporter.
     */
    onReport: async (ctx: PluginContext, result: any) => {
        const flags = ctx.flags || {};
        if (!flags.detectSoft404 || !ctx.db) return;

        // Pull directly from our scoped SQLite plugin table
        const allRows = ctx.db.data.all<{ url_id: number; score: number; reason: string }>();
        const soft404Pages = allRows.filter(r => r.score > 0.5);

        if (soft404Pages.length > 0) {
            if (!result.plugins) result.plugins = {};

            const mappedPages = (result.pages || []).filter((p: any) => p.soft404Score && p.soft404Score > 0.5)
                .map((p: any) => ({ url: p.url, score: p.soft404Score }));

            result.plugins.soft404 = {
                totalDetected: mappedPages.length > 0 ? mappedPages.length : soft404Pages.length,
                topSample: mappedPages.slice(0, 5)
            };
        }
    }
};
