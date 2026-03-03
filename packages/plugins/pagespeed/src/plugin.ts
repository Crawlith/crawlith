import { PageSpeedService } from './PageSpeedService.js';
import { PageSpeedOutput } from './PageSpeedOutput.js';
import { PageSpeedRow } from './types.js';
import type { PluginContext } from '@crawlith/core';

const STRATEGY = 'mobile';

/**
 * PageSpeed Plugin Hooks implementation.
 */
export const PageSpeedHooks = {
    /**
     * Initialization hook: Registers the persistent database schema for PageSpeed metrics.
     */
    onInit: async (ctx: PluginContext) => {
        if (!ctx.db) return;

        ctx.db.schema.define({
            strategy: "TEXT CHECK(strategy IN ('mobile', 'desktop')) NOT NULL",
            performance_score: "INTEGER",
            lcp: "REAL",
            cls: "REAL",
            tbt: "REAL",
            raw_json: "TEXT NOT NULL"
        });
    },

    /**
     * Report hook: Executes after a page analysis to perform performance auditing.
     * Implements smart caching and persists results to the database.
     */
    onReport: async (ctx: PluginContext, result: any) => {
        const flags = ctx.flags || {};
        if (ctx.command !== 'page' || !flags.pagespeed) return;
        if (!ctx.db || !ctx.config) return;

        result.plugins = result.plugins || {};
        const service = new PageSpeedService();

        try {
            const pageUrl = ctx.targetUrl;
            if (!pageUrl || !URL.canParse(pageUrl)) {
                throw new Error('PageSpeed requires an absolute target URL.');
            }

            const apiKey = ctx.config.require();

            // Smart Caching: Look globally across snapshots for this URL within last 24h
            let raw: any = null;
            if (!flags.force) {
                const cached = ctx.db.data.find<PageSpeedRow>(pageUrl, {
                    maxAge: '24h',
                    global: true
                });
                if (cached) raw = cached.raw_json;
            }

            let summary;

            if (raw) {
                summary = service.summarize(raw, 'cache', STRATEGY);
            } else {
                raw = await service.fetch(pageUrl, apiKey, STRATEGY);
                summary = service.summarize(raw, 'api', STRATEGY);

                ctx.db.data.save({
                    url: pageUrl,
                    data: {
                        strategy: STRATEGY,
                        performance_score: summary.score,
                        lcp: summary.lcp,
                        cls: summary.cls,
                        tbt: summary.tbt,
                        raw_json: raw
                    }
                });
            }

            // Only attach summary to the result object (prevents raw JSON leakage)
            result.plugins.pagespeed = { summary };
            PageSpeedOutput.emit(ctx, { summary });
        } catch (error) {
            const message = (error as Error).message;
            result.plugins.pagespeed = { error: message };
            PageSpeedOutput.emit(ctx, { error: message });
            ctx.logger?.error(`[plugin:pagespeed] ${message}`);
        }
    }
};
