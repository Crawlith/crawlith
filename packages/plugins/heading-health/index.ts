import type { CrawlithPlugin } from '@crawlith/core';
import { registerHeadingHealthCli } from './src/cli.js';
import { HeadingHealthHooks } from './src/plugin.js';

/**
 * Heading Health Plugin.
 *
 * Analyzes heading hierarchy quality, content thinness, and template duplication risk.
 * Persists URL-scoped analysis records via ctx.db for 24h cache reuse.
 */
export const HeadingHealthPlugin: CrawlithPlugin = {
    name: 'heading-health',
    description: 'Analyzes heading structure, hierarchy health, and content distribution',
    register: (cli) => {
        registerHeadingHealthCli(cli);
    },
    hooks: HeadingHealthHooks
};

export default HeadingHealthPlugin;
