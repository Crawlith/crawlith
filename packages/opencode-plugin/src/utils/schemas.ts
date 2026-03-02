import { z } from 'zod';

/**
 * Global crawl limits used to enforce safe deterministic execution in OpenCode sessions.
 */
export const CRAWL_LIMIT_CAP = 5000;

/**
 * Maximum per-crawl concurrency accepted by this plugin.
 */
export const CRAWL_CONCURRENCY_CAP = 8;

/**
 * Shared URL schema for all tools that accept a crawl target.
 */
export const urlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'URL must use http or https');

/**
 * Input schema for crawlSite tool.
 */
export const crawlSiteArgsSchema = z.object({
  url: urlSchema,
  limit: z.number().int().positive().max(CRAWL_LIMIT_CAP).default(1000),
  depth: z.number().int().min(0).max(10).optional(),
  allowPrivateIPs: z.boolean().default(false)
});

/**
 * Input schema for tools operating on one snapshot.
 */
export const snapshotIdArgsSchema = z.object({
  snapshotId: z.number().int().positive()
});

/**
 * Input schema for diffSnapshots tool.
 */
export const diffSnapshotsArgsSchema = z.object({
  base: z.number().int().positive(),
  head: z.number().int().positive()
});
