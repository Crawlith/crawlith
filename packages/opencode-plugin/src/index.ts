import { createAnalyzeSnapshotTool } from './tools/analyzeSnapshot.js';
import { createCrawlSiteTool } from './tools/crawlSite.js';
import { createDiffSnapshotsTool } from './tools/diffSnapshots.js';
import { createHighAuthorityGapsTool } from './tools/getHighAuthorityGaps.js';
import { createSessionHooks } from './events/sessionHooks.js';
import { OpenCodePluginContext } from './utils/types.js';

/**
 * OpenCode plugin entrypoint for Crawlith structured tooling.
 */
export async function CrawlithPlugin(context: OpenCodePluginContext) {
  const { client } = context;

  return {
    tool: {
      crawlSite: createCrawlSiteTool(client),
      analyzeSnapshot: createAnalyzeSnapshotTool(),
      diffSnapshots: createDiffSnapshotsTool(),
      getHighAuthorityGaps: createHighAuthorityGapsTool()
    },
    event: createSessionHooks(client)
  };
}

export default CrawlithPlugin;
