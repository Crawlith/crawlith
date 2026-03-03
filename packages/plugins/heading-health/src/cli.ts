import type { Command } from '@crawlith/core';

/**
 * Registers CLI options exposed by the heading-health plugin.
 */
export function registerHeadingHealthCli(cli: Command): void {
    if (cli.name() === 'crawl' || cli.name() === 'page') {
        cli.option('--heading', 'Analyze heading structure and hierarchy health');
        cli.option('--heading-force-refresh', 'Bypass the 24h heading-health cache and recompute');
    }
}
