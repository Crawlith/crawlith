import type { PluginContext, PageInput } from '@crawlith/core';
import { HeadingHealthOutput } from './Output.js';
import { HeadingHealthService } from './HeadingHealthService.js';
import type { HeadingHealthPayload, HeadingHealthRow, HeadingHealthSummary } from './types.js';

/**
 * Lifecycle hooks for the heading-health plugin.
 * Schema registration is handled declaratively via plugin.storage — no onInit needed.
 */
export const HeadingHealthHooks = {
    /**
     * Single-page hook (page command). Analyzes one URL's HTML directly.
     * No cross-page duplicate signals since only one page is available.
     */
    onPage: async (ctx: PluginContext, page: PageInput): Promise<void> => {
        if (!ctx.flags?.heading || !ctx.db) return;

        const service = new HeadingHealthService();

        const row = await ctx.db.data.getOrFetch<HeadingHealthRow>(
            page.url,
            async () => {
                const payload = service.evaluateSinglePage(page.url, page.html);
                return {
                    score: payload.score,
                    status: payload.status,
                    // Store as string, but getOrFetch/find will auto-parse to object later
                    analysis_json: JSON.stringify(payload)
                } as unknown as HeadingHealthRow;
            }
        );

        if (!row) return;

        // analysis_json gets auto-parsed by CrawlithDB._parseRow
        const payload = (typeof row.analysis_json === 'string'
            ? JSON.parse(row.analysis_json)
            : row.analysis_json) as HeadingHealthPayload;

        HeadingHealthOutput.emitSingle(ctx, payload);
    },

    /**
     * Graph-level hook (crawl command). Evaluates all nodes with cross-page duplicate detection.
     */
    onMetrics: async (ctx: PluginContext, graph: any): Promise<void> => {
        if (!ctx.flags?.heading || !ctx.db) return;

        const nodes = graph?.getNodes?.();
        if (!Array.isArray(nodes)) return;

        const service = new HeadingHealthService();
        const { payloadsByUrl, summary } = service.evaluateNodes(nodes);

        for (const node of nodes) {
            const url = node?.url;
            if (!url) continue;

            const livePayload = payloadsByUrl.get(url);
            if (!livePayload) continue;

            const row = await ctx.db.data.getOrFetch<HeadingHealthRow>(
                url,
                async () => ({
                    score: livePayload.score,
                    status: livePayload.status,
                    analysis_json: JSON.stringify(livePayload)
                } as unknown as HeadingHealthRow)
            );

            if (row) {
                const payload = (typeof row.analysis_json === 'string'
                    ? JSON.parse(row.analysis_json)
                    : row.analysis_json) as HeadingHealthPayload;

                (node as any).headingHealth = payload;
            }
        }

        ctx.metadata = ctx.metadata || {};
        ctx.metadata.headingHealthSummary = summary;
        HeadingHealthOutput.emitSummary(ctx, summary);
    },

    /**
     * Attaches snapshot-level heading-health summary to the final report object.
     */
    onReport: async (ctx: PluginContext, result: any): Promise<void> => {
        if (!ctx.flags?.heading) return;

        const summary = ctx.metadata?.headingHealthSummary as HeadingHealthSummary | undefined;
        if (!summary) return;

        result.plugins = result.plugins || {};
        result.plugins.headingHealth = summary;
    }
};
