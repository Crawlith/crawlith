import { getDb } from '@crawlith/core';
import { requireSnapshot, truncateList } from '../utils/db.js';
import { snapshotIdArgsSchema } from '../utils/schemas.js';

interface AuthorityGap {
  url: string;
  authorityScore: number;
}

/**
 * Structured output for getHighAuthorityGaps.
 */
export interface HighAuthorityGapsResult {
  pagesMissingSchema: AuthorityGap[];
  pagesMissingOG: AuthorityGap[];
  pagesMissingLang: AuthorityGap[];
}

/**
 * Builds the getHighAuthorityGaps tool for opportunity discovery.
 */
export function createHighAuthorityGapsTool() {
  return {
    description: 'List high-authority pages missing critical SEO metadata fields.',
    args: snapshotIdArgsSchema,
    async run(input: unknown): Promise<HighAuthorityGapsResult> {
      const { snapshotId } = snapshotIdArgsSchema.parse(input);
      requireSnapshot(snapshotId);

      const db = getDb();
      const rows = db
        .prepare(
          `SELECT p.normalized_url AS url,
                  COALESCE(m.authority_score, m.pagerank_score, m.pagerank, 0) AS authorityScore,
                  p.html AS html
           FROM pages p
           JOIN snapshots s ON s.site_id = p.site_id
           LEFT JOIN metrics m ON m.snapshot_id = s.id AND m.page_id = p.id
           WHERE s.id = ? AND p.first_seen_snapshot_id <= ?`
        )
        .all(snapshotId, snapshotId) as Array<{ url: string; authorityScore: number; html: string | null }>;

      const ordered = rows.sort((a, b) => b.authorityScore - a.authorityScore);
      const missingSchema: AuthorityGap[] = [];
      const missingOg: AuthorityGap[] = [];
      const missingLang: AuthorityGap[] = [];

      for (const row of ordered) {
        const html = row.html ?? '';
        const gap = { url: row.url, authorityScore: Number(row.authorityScore.toFixed(6)) };

        if (!html.includes('application/ld+json')) {
          missingSchema.push(gap);
        }
        if (!html.includes('property="og:') && !html.includes("property='og:")) {
          missingOg.push(gap);
        }
        if (!html.includes('<html lang=')) {
          missingLang.push(gap);
        }
      }

      return {
        pagesMissingSchema: truncateList(missingSchema),
        pagesMissingOG: truncateList(missingOg),
        pagesMissingLang: truncateList(missingLang)
      };
    }
  };
}
