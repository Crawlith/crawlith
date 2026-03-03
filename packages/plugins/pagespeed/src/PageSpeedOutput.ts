import { PluginContext } from '@crawlith/core';
import { PageSpeedSummary } from './types.js';

/**
 * Handles the visual presentation of PageSpeed results in the CLI.
 */
export class PageSpeedOutput {
    /**
     * Emits formatted PageSpeed results to the CLI logger.
     * Logic handles success summaries with color-coded scores and error reporting.
     * 
     * @param ctx - The plugin context containing the logger.
     * @param payload - The data to emit, including either a success summary or an error string.
     */
    static emit(ctx: PluginContext, payload: { summary?: PageSpeedSummary; error?: string }): void {
        if (payload.error) {
            ctx.logger?.error(`\nPageSpeed Report (Mobile)\n\nError: ${payload.error}`);
            return;
        }

        const summary = payload.summary;
        if (!summary) return;
        const scoreTone = summary.score >= 90 ? 'good' : (summary.score >= 50 ? 'warn' : 'bad');
        const sourceText = summary.source === 'cache' ? 'cache (24h)' : 'api';

        ctx.logger?.info(`\nPageSpeed Report (Mobile)\n`);
        ctx.logger?.info(`Performance Score: ${summary.score}/100 (${scoreTone}, source: ${sourceText})`);
        ctx.logger?.info(`LCP: ${summary.lcp !== null ? `${summary.lcp}s` : 'N/A'}`);
        ctx.logger?.info(`CLS: ${summary.cls !== null ? summary.cls : 'N/A'}`);
        ctx.logger?.info(`TBT: ${summary.tbt !== null ? `${summary.tbt}ms` : 'N/A'}`);
        ctx.logger?.info(`Core Web Vitals: ${summary.coreWebVitals}`);
        ctx.logger?.info(`Field Data: ${summary.hasFieldData ? 'Available' : 'Not available (low traffic URL)'}`);
    }
}
