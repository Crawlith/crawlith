import { CrawlithPlugin } from '@crawlith/core';
import { HitsHooks } from './src/plugin.js';

/**
 * Description: Hubs and Authorities (HITS) is a link analysis algorithm that rates web pages.
 * Authority measures the valuable information on a page, while Hub measures the quality of the links to other pages.
 * @requirements Use --compute-hits to enable during crawl.
 */
export const HitsPlugin: CrawlithPlugin = {
  name: 'hits',

  cli: {
    flag: '--compute-hits',
    description: 'Compute Hub and Authority scores (HITS)'
  },

  scoreProvider: true,

  storage: {
    fetchMode: 'local',
    perPage: {
      columns: {
        authority_score: 'REAL',
        hub_score: 'REAL',
        link_role: 'TEXT',
        score: 'REAL' // Composite score for aggregation provider
      }
    }
  },

  hooks: HitsHooks
};

export default HitsPlugin;
