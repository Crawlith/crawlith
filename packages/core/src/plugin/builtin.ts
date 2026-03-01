/**
 * Built-in plugin registry.
 *
 * This file re-exports every first-party plugin so that consumers
 * (CLI, server, tests) can import the canonical set from a single place.
 * The actual implementations live in packages/plugins/*.
 */
export type { CrawlPlugin } from './types.js';

// Re-exported so existing `import { builtinPlugins } from '@crawlith/core'`
// keeps working without consumers needing to know about individual packages.
// The CLI's plugins.ts is the canonical "wiring" point; this array is a
// convenience for tests and the use-case layer.

// NOTE: We cannot `import from '@crawlith/plugin-*'` inside core because
// that would create a circular dependency (plugins depend on core).
// Instead, the CLI assembles the registry.  Core only exports the empty
// array as a placeholder so the API signature doesn't break.

import type { CrawlPlugin } from './types.js';
export const builtinPlugins: CrawlPlugin[] = [];
