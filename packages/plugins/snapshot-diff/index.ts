import type { CrawlithPlugin, Command } from '@crawlith/core';
import { registerSnapshotDiffCli } from './src/cli.js';
import { snapshotDiffHooks } from './src/plugin.js';

/**
 * Snapshot Diff Plugin.
 *
 * Provides two crawl-time features:
 * - snapshot-to-snapshot graph comparison via `--compare <oldSnapshotId> <newSnapshotId>`
 * - incremental baseline loading via `--incremental`
 */
export const SnapshotDiffPlugin: CrawlithPlugin = {
  name: 'snapshot-diff',
  register: (cli: Command) => {
    registerSnapshotDiffCli(cli);
  },
  hooks: snapshotDiffHooks
};

export default SnapshotDiffPlugin;
