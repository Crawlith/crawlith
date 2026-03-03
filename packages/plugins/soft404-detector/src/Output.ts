import { PluginContext } from '@crawlith/core';
import { Soft404Result } from './types.js';

/**
 * Handles presentation and standardized logging for the Soft404 plugin.
 */
export class Soft404Output {
    /**
     * Emits logging output for a single evaluated page.
     * @param {PluginContext} ctx - Plugin context for logging access.
     * @param {string} url - Target URL.
     * @param {Soft404Result} result - The evaluation payload.
     */
    public static emitSingle(ctx: PluginContext, url: string, result: Soft404Result): void {
        if (!ctx.logger) return;

        if (result.score === 0) {
            ctx.logger.info(`[Soft404] ${url} | Score: 0 (No issues detected)`);
        } else {
            ctx.logger.warn(`[Soft404] ${url} | Score: ${result.score} | Reason: ${result.reason}`);
        }
    }
}
