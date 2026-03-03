import type { PluginContext } from '@crawlith/core';
import type { SignalsSummary } from './types.js';

/**
 * Presentation helpers for CLI logs.
 */
export class SignalsOutput {
  /**
   * Emits a compact crawl summary when signals analysis is enabled.
   */
  static emitSummary(ctx: PluginContext, summary: SignalsSummary): void {
    ctx.logger?.info?.(`[signals] Score ${summary.signalsScore} | JSON-LD ${summary.coverage.jsonld}% | OG ${summary.coverage.og}% | Lang ${summary.coverage.lang}%`);
  }
}
