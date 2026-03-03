import { CrawlithPlugin } from '@crawlith/core';
import { HealthScoreHooks } from './src/plugin.js';

/**
 * Health Score Engine Plugin
 * Calculates site-wide SEO health, identifies critical issues, and provides a penalty-based scoring system.
 */
export const HealthScoreEnginePlugin: CrawlithPlugin = {
  name: 'health-score-engine',
  description: 'Iterative penalty-based health scoring and issue collection',

  cli: {
    flag: '--health', // We can add a flag to explicitly enable it if it wasn't default
    description: 'Run health score analysis',
    options: [
      { flag: '--fail-on-critical', description: 'Exit code 1 if critical issues exist' },
      { flag: '--score-breakdown', description: 'Print health score component weights' }
    ]
  },

  scoreProvider: true,

  storage: {
    fetchMode: 'local',
    perPage: {
      columns: {
        score: 'REAL',
        weight: 'REAL'
      }
    }
  },

  hooks: HealthScoreHooks
};

export default HealthScoreEnginePlugin;
