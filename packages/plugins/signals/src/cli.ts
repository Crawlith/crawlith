import type { Command } from '@crawlith/core';

/**
 * Registers legacy command options for compatibility with imperative registration.
 */
export function registerSignalsCli(cli: Command): void {
  if (cli.name() === 'crawl' || cli.name() === 'page') {
    cli.option('--signals', 'Enable structured signals intelligence analysis');
  }
}
