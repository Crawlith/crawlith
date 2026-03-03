
import { CrawlithPlugin } from '@crawlith/core';
import { ClusteringHooks } from './src/plugin.js';

/**
 * Content Clustering Plugin
 * Crawlith plugin for content clustering
 */
export const ContentClusteringPlugin: CrawlithPlugin = {
  name: 'content-clustering',
  description: 'Detects near-duplicate content clusters using SimHash LSH',

  cli: {
    flag: '--clustering',
    description: 'Enable content clustering analysis',
    options: [
      { flag: '--cluster-threshold <number>', description: 'Hamming distance for content clusters', defaultValue: '10' },
      { flag: '--min-cluster-size <number>', description: 'Minimum pages per cluster', defaultValue: '3' }
    ]
  },

  storage: {
    fetchMode: 'local',
    perPage: {
      columns: {
        cluster_id: 'INTEGER'
      }
    }
  },

  hooks: ClusteringHooks
};

export default ContentClusteringPlugin;
