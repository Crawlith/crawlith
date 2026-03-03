import type { PluginContext } from '@crawlith/core';
import type { HeadingHealthPayload, HeadingHealthSummary } from './types.js';

/**
 * Responsible for plugin logging output.
 */
export class HeadingHealthOutput {
    /**
     * Emits a single-line result for a single-page heading-health analysis (page command).
     */
    public static emitSingle(ctx: PluginContext, payload: HeadingHealthPayload): void {
        ctx.logger?.info(
            `[plugin:heading-health] score=${payload.score} (${payload.status})` +
            (payload.issues.length ? ` — ${payload.issues.join(', ')}` : '')
        );
    }

    /**
     * Emits a single-line summary for heading-health metrics (crawl command).
     */
    public static emitSummary(ctx: PluginContext, summary: HeadingHealthSummary): void {
        ctx.logger?.info(
            `[plugin:heading-health] analyzed=${summary.evaluatedPages}, avgScore=${summary.avgScore}, poorPages=${summary.poorPages}`
        );
    }
}
