import { Command } from '@crawlith/core';

/**
 * Registers snapshot-diff CLI options on the crawl command.
 * @param cli Crawlith command instance.
 */
export function registerSnapshotDiffCli(cli: Command): void {
  if (cli.name() !== 'crawl') return;

  cli
    .option('--incremental', 'incremental crawl using previous completed snapshot')
    .option('--compare <snapshots...>', 'internal: compare two snapshot IDs');
}
