import type { CrawlithPlugin } from '@crawlith/core';
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

    cli: {
        flag: '--heading',
        description: 'Analyze heading structure and hierarchy health',
        for: ['page', 'crawl'],
        options: [
            { flag: '--heading-force-refresh', description: 'Bypass the 24h heading-health cache and recompute' }
        ]
    },

    scoreProvider: true,

    storage: {
        fetchMode: 'local',
        perPage: {

            columns: {
                status: 'TEXT',
                analysis_json: 'TEXT'
            }
        }
    },

    hooks: {
        onPage: HeadingHealthHooks.onPage,
        onMetrics: HeadingHealthHooks.onMetrics,
        onReport: HeadingHealthHooks.onReport
    }
};

export default HeadingHealthPlugin;
