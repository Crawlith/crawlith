import { version } from './utils/version.js';

export const DEFAULTS = {
    // Crawler defaults
    MAX_DEPTH: 5,
    MAX_DEPTH_LIMIT: 10,
    CONCURRENCY: 2,
    CONCURRENCY_LIMIT: 10,
    CRAWL_LIMIT: 500,

    // Network/Fetcher defaults
    USER_AGENT: `crawlith/${version}`,
    RATE_LIMIT: 10,
    MAX_BYTES: 2000000, // 2MB
    MAX_REDIRECTS: 5,
    MAX_REDIRECTS_LIMIT: 11,

    // Network timeouts
    HEADERS_TIMEOUT: 10000,
    BODY_TIMEOUT: 10000,
    // Keep only last 5 snapshots
    MAX_SNAPSHOTS: 5
} as const;
