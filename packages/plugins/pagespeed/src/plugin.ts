import { PageSpeedService } from './PageSpeedService.js';
import { PageSpeedOutput } from './PageSpeedOutput.js';
import { PageSpeedRow } from './types.js';
import type { PluginContext, PageInput } from '@crawlith/core';

const STRATEGY = 'mobile';

/**
 * PageSpeed Plugin Hooks implementation.
 * Schema registration is handled declaratively via plugin.storage — no onInit needed.
 */
export const PageSpeedHooks = {
    /**
     * Page hook: Executes for a single URL to perform performance auditing.
     * Implements smart caching and persists results to the database.
     */
    onPage: async (ctx: PluginContext, page: PageInput) => {
        const flags = ctx.flags || {};
        if (!flags.pagespeed) return;
        if (!ctx.db || !ctx.config) return;

        const service = new PageSpeedService();

        try {
            const pageUrl = page.url;
            if (!pageUrl || !URL.canParse(pageUrl)) {
                throw new Error('PageSpeed requires an absolute target URL.');
            }

            const apiKey = ctx.config.require();

            const row = await ctx.db.data.getOrFetch<PageSpeedRow>(
                pageUrl,
                async () => {
                    const freshRaw = await service.fetch(pageUrl, apiKey, STRATEGY);
                    const freshSummary = service.summarize(freshRaw, 'api', STRATEGY);
                    return {
                        strategy: STRATEGY,
                        performance_score: freshSummary.score,
                        lcp: freshSummary.lcp,
                        cls: freshSummary.cls,
                        tbt: freshSummary.tbt,
                        raw_json: freshRaw
                    } as PageSpeedRow;
                }
            );

            if (!row) {
                ctx.cli?.info(`[plugin:pagespeed] No local cache for ${pageUrl}. Run with --live to fetch from API.`);
                return;
            }

            // Summarize the data that was retrieved (either cached or freshly fetched above)
            const summary = service.summarize(row.raw_json, row.created_at ? 'cache' : 'api', STRATEGY);

            PageSpeedOutput.emit(ctx, { summary });

        } catch (error) {
            const message = (error as Error).message;
            PageSpeedOutput.emit(ctx, { error: message });
            ctx.logger?.error(`[plugin:pagespeed] ${message}`);
        }
    }
};
