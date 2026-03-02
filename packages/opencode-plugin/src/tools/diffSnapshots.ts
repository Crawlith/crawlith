import { calculateMetrics, compareGraphs, getDb, loadGraphFromSnapshot } from '@crawlith/core';
import { requireSnapshot, truncateList } from '../utils/db.js';
import { diffSnapshotsArgsSchema } from '../utils/schemas.js';

/**
 * Structured output returned from diffSnapshots.
 */
export interface DiffSnapshotsResult {
  newPages: string[];
  removedPages: string[];
  newOrphans: string[];
  lostInternalLinks: Array<{ url: string; lost: number }>;
  schemaRegressions: string[];
  authorityShiftSummary: {
    avgDelta: number;
    gainedAuthorityPages: number;
    lostAuthorityPages: number;
  };
}

/**
 * Builds the diffSnapshots tool for snapshot regression analysis.
 */
export function createDiffSnapshotsTool() {
  return {
    description: 'Compare two snapshots and return URL-level regression signals.',
    args: diffSnapshotsArgsSchema,
    async run(input: unknown): Promise<DiffSnapshotsResult> {
      const { base, head } = diffSnapshotsArgsSchema.parse(input);
      requireSnapshot(base);
      requireSnapshot(head);

      const baseGraph = loadGraphFromSnapshot(base);
      const headGraph = loadGraphFromSnapshot(head);
      const diff = compareGraphs(baseGraph, headGraph);

      const baseOrphans = new Set(calculateMetrics(baseGraph, 10).orphanPages);
      const headOrphans = new Set(calculateMetrics(headGraph, 10).orphanPages);
      const newOrphans = [...headOrphans].filter((url) => !baseOrphans.has(url));

      const baseNodeMap = new Map(baseGraph.getNodes().map((node) => [node.url, node]));
      const headNodeMap = new Map(headGraph.getNodes().map((node) => [node.url, node]));
      const lostInternalLinks = [...headNodeMap.values()]
        .map((headNode) => {
          const baseNode = baseNodeMap.get(headNode.url);
          const lost = (baseNode?.inLinks ?? 0) - headNode.inLinks;
          return { url: headNode.url, lost };
        })
        .filter((item) => item.lost > 0)
        .sort((a, b) => b.lost - a.lost);

      const db = getDb();
      const schemaRegressionRows = db
        .prepare(
          `SELECT bp.normalized_url AS url
           FROM pages bp
           JOIN snapshots bs ON bs.site_id = bp.site_id
           JOIN pages hp ON hp.site_id = bp.site_id AND hp.normalized_url = bp.normalized_url
           JOIN snapshots hs ON hs.site_id = hp.site_id
           WHERE bs.id = ?
             AND hs.id = ?
             AND bp.first_seen_snapshot_id <= bs.id
             AND hp.first_seen_snapshot_id <= hs.id
             AND bp.html LIKE '%application/ld+json%'
             AND (hp.html IS NULL OR hp.html NOT LIKE '%application/ld+json%')`
        )
        .all(base, head) as Array<{ url: string }>;

      const authorityChanges = [...headNodeMap.values()]
        .map((node) => {
          const previous = baseNodeMap.get(node.url);
          const delta = (node.pageRank ?? 0) - (previous?.pageRank ?? 0);
          return delta;
        });
      const avgDelta =
        authorityChanges.length === 0
          ? 0
          : authorityChanges.reduce((sum, value) => sum + value, 0) / authorityChanges.length;

      return {
        newPages: truncateList(diff.addedUrls),
        removedPages: truncateList(diff.removedUrls),
        newOrphans: truncateList(newOrphans),
        lostInternalLinks: truncateList(lostInternalLinks),
        schemaRegressions: truncateList(schemaRegressionRows.map((row) => row.url)),
        authorityShiftSummary: {
          avgDelta: Number(avgDelta.toFixed(6)),
          gainedAuthorityPages: authorityChanges.filter((value) => value > 0).length,
          lostAuthorityPages: authorityChanges.filter((value) => value < 0).length
        }
      };
    }
  };
}
