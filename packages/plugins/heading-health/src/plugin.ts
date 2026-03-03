import type { PluginContext } from '@crawlith/core';
import { HeadingHealthOutput } from './Output.js';
import { HeadingHealthService } from './HeadingHealthService.js';
import type { HeadingHealthPayload, HeadingHealthRow, HeadingHealthSummary } from './types.js';

/**
 * Lifecycle hooks for the heading-health plugin.
 */
export const HeadingHealthHooks = {
    /**
     * Registers schema columns used for URL-scoped heading-health persistence.
     */
    onInit: async (ctx: PluginContext): Promise<void> => {
        if (!ctx.db) {
            return;
        }

        ctx.db.schema.define({
            score: 'INTEGER NOT NULL',
            status: "TEXT CHECK(status IN ('Healthy', 'Moderate', 'Poor')) NOT NULL",
            analysis_json: 'TEXT NOT NULL'
        });
    },

    /**
     * Evaluates heading health for each eligible graph node, persisting URL-scoped data with 24h cache reads.
     */
    onMetrics: async (ctx: PluginContext, graph: any): Promise<void> => {
        if (!ctx.flags?.heading) {
            return;
        }

        const nodes = graph?.getNodes?.();
        if (!Array.isArray(nodes)) {
            return;
        }

        const service = new HeadingHealthService();
        const { payloadsByUrl, summary } = service.evaluateNodes(nodes);

        for (const node of nodes) {
            const url = node?.url;
            if (!url) {
                continue;
            }

            const livePayload = payloadsByUrl.get(url);
            if (!livePayload) {
                continue;
            }

            const payload = readCachedPayload(ctx, url, livePayload);
            (node as any).headingHealth = payload;
            persistPayload(ctx, url, payload);
        }

        ctx.metadata = ctx.metadata || {};
        ctx.metadata.headingHealthSummary = summary;
        HeadingHealthOutput.emitSummary(ctx, summary);
    },

    /**
     * Attaches snapshot-level heading-health summary to the final report object.
     */
    onReport: async (ctx: PluginContext, result: any): Promise<void> => {
        if (!ctx.flags?.heading) {
            return;
        }

        const summary = ctx.metadata?.headingHealthSummary as HeadingHealthSummary | undefined;
        if (!summary) {
            return;
        }

        result.plugins = result.plugins || {};
        result.plugins.headingHealth = summary;
    }
};

function readCachedPayload(ctx: PluginContext, url: string, fallback: HeadingHealthPayload): HeadingHealthPayload {
    if (!ctx.db || ctx.flags?.headingForceRefresh) {
        return fallback;
    }

    const cached = ctx.db.data.find<HeadingHealthRow>(url, { maxAge: '24h', global: true });
    if (!cached?.analysis_json) {
        return fallback;
    }

    try {
        return JSON.parse(cached.analysis_json) as HeadingHealthPayload;
    } catch {
        ctx.logger?.warn(`[plugin:heading-health] invalid cached JSON for ${url}, recomputing`);
        return fallback;
    }
}

function persistPayload(ctx: PluginContext, url: string, payload: HeadingHealthPayload): void {
    if (!ctx.db) {
        return;
    }

    ctx.db.data.save({
        url,
        data: {
            score: payload.score,
            status: payload.status,
            analysis_json: JSON.stringify(payload)
        }
    });
}
