import { CrawlithPlugin } from '@crawlith/core';
import { PageRankHooks } from './src/plugin.js';

/**
 * Description: PageRank calculates the relative authority of pages across a snapshot based on internal link weight and distribution.
 * @requirements Must have a fully built graph from a 'crawl' execution spanning 100+ edges to be precise.
 */
export const PageRankPlugin: CrawlithPlugin = {
  name: 'pagerank',

  // Implicitly activated inside core due to its legacy importance, 
  // but mapping 'flag' cleanly for new PluginRegistry loaders.
  cli: {
    flag: '--pagerank',
    description: 'Calculate PageRank'
  },

  scoreProvider: true, // Automatically sums total pagerank score distributed natively across snapshots

  storage: {
    fetchMode: 'local',
    perPage: {
      columns: {
        raw_rank: 'REAL',
        score: 'REAL'
      }
    }
  },

  hooks: PageRankHooks
};

export default PageRankPlugin;
