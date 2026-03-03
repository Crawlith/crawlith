import { CrawlithPlugin } from '@crawlith/core';
import { Soft404Hooks } from './src/plugin.js';

/**
 * Description: Soft404 Detector Plugin calculates the likelihood of a Soft 404 response.
 * @requirements None.
 */
export const Soft404DetectorPlugin: CrawlithPlugin = {
  name: 'soft404-detector',

  cli: {
    flag: '--detect-soft404',
    description: 'Detect soft 404 pages'
  },

  scoreProvider: true,

  storage: {
    fetchMode: 'local',
    perPage: {
      columns: {
        reason: 'TEXT'
      }
    }
  },

  hooks: Soft404Hooks
};

export default Soft404DetectorPlugin;
