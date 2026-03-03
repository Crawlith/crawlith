import type { CrawlithPlugin } from '@crawlith/core';
import { SignalsHooks } from './src/plugin.js';

/**
 * Signals Plugin.
 *
 * Extracts social metadata and structured-data coverage,
 * persists per-page records via scoped plugin storage,
 * and emits crawl-level remediation priorities.
 */
export const SignalsPlugin: CrawlithPlugin = {
  name: 'signals',
  description: 'Structured signals intelligence and metadata coverage analysis',

  cli: {
    flag: '--signals',
    description: 'Enable structured signals intelligence analysis',
    for: ['page', 'crawl']
  },

  scoreProvider: true,

  storage: {
    fetchMode: 'local',
    perPage: {
      columns: {
        status: 'TEXT',
        has_og: 'INTEGER',
        has_lang: 'INTEGER',
        has_hreflang: 'INTEGER',
        has_jsonld: 'INTEGER',
        broken_jsonld: 'INTEGER',
        schema_hash: 'TEXT',
        og_hash: 'TEXT',
        signals_json: 'TEXT'
      }
    }
  },


  hooks: SignalsHooks
};

export default SignalsPlugin;
