import type { PluginContext } from '@crawlith/core';
import type { HeadingHealthSummary } from './types.js';

/**
 * Responsible for plugin logging output.
 */
export class HeadingHealthOutput {
    /**
     * Emits a single-line summary for heading-health metrics.
     */
    public static emitSummary(ctx: PluginContext, summary: HeadingHealthSummary): void {
        ctx.logger?.info(
            `[plugin:heading-health] analyzed=${summary.evaluatedPages}, avgScore=${summary.avgScore}, poorPages=${summary.poorPages}`
        );
    }
}
