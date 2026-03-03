import type { PluginContext } from '@crawlith/core';
import { renderJsonDiffOutput, renderPrettyDiffOutput } from './Output.js';
import { SnapshotDiffService } from './Service.js';
import type { SnapshotDiffFlags } from './types.js';

const service = new SnapshotDiffService();

/**
 * Hook implementation for snapshot diff and incremental baseline resolution.
 */
export const snapshotDiffHooks = {
  /**
   * Handles `--compare` execution before crawl starts.
   * @param ctx Plugin context for current command invocation.
   */
  onInit: async (ctx: PluginContext) => {
    const flags = (ctx.flags || {}) as SnapshotDiffFlags;
    const compareRequest = service.parseCompareRequest(flags);
    if (!compareRequest) return;

    const diffResult = service.compareSnapshots(compareRequest);
    const outputFormat = service.parseOutputFormat(flags);

    if (outputFormat === 'json') {
      renderJsonDiffOutput(diffResult);
    } else {
      renderPrettyDiffOutput(compareRequest.oldSnapshotId, compareRequest.newSnapshotId, diffResult);
    }

    ctx.terminate = true;
  },

  /**
   * Loads previous completed snapshot graph when incremental mode is enabled.
   * @param ctx Plugin context for current crawl execution.
   */
  onCrawlStart: async (ctx: PluginContext) => {
    const flags = (ctx.flags || {}) as SnapshotDiffFlags;
    if (!flags.incremental) return;

    const targetUrl = service.getTargetUrl(ctx);
    if (!targetUrl) return;

    ctx.logger?.info('🔍 Resolving previous snapshot for incremental crawl...');

    try {
      const previousGraph = service.resolvePreviousGraph(targetUrl);
      if (!previousGraph) return;

      if (!ctx.metadata) ctx.metadata = {};
      ctx.metadata.previousGraph = previousGraph;
      ctx.logger?.info('Loaded previous snapshot graph for incremental diffing.');
    } catch {
      ctx.logger?.warn('Unable to resolve previous snapshot graph for incremental crawl.');
    }
  }
};
