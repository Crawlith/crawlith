import crypto from 'node:crypto';
import { normalizeUrl } from '../crawler/normalize.js';

// Flags that change the nature of the crawl and should be part of the lock key
const RELEVANT_FLAGS = [
  'limit',
  'depth',
  'output',
  'sitemap',
  'incremental',
  'detectSoft404',
  'detectTraps',
  'includeSubdomains',
  'allow',
  'deny',
  'proxy',
  'ua',
  'maxRedirects',
  'rate',
  'maxBytes',
  'concurrency'
];

export function generateLockKey(commandName: string, targetUrl: string, options: any): string {
  // Respect the query stripping option consistent with crawl logic
  const stripQuery = !options.query;

  const normalizedTarget = normalizeUrl(targetUrl, '', { stripQuery }) || targetUrl;

  // Extract relevant options in a deterministic order
  const lockOptions: Record<string, any> = {};
  for (const key of RELEVANT_FLAGS) {
    if (options[key] !== undefined) {
      lockOptions[key] = options[key];
    }
  }

  // Create composite key object
  const compositeKey = {
    command: commandName,
    target: normalizedTarget,
    options: lockOptions
  };

  // Stringify and hash
  // Since we inserted keys in a deterministic order (RELEVANT_FLAGS order),
  // JSON.stringify will produce a stable string in V8/Node.js.
  const stableString = JSON.stringify(compositeKey);

  return crypto.createHash('sha256').update(stableString).digest('hex');
}
