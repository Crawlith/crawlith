import { calculateHealthScore, calculateMetrics, collectCrawlIssues, getDb, loadGraphFromSnapshot } from '@crawlith/core';
import { snapshotIdArgsSchema } from '../utils/schemas.js';
import { requireSnapshot } from '../utils/db.js';

/**
 * Summary of PageRank distribution for a snapshot.
 */
interface PagerankSummary {
  avg: number;
  max: number;
  p95: number;
}

/**
 * Structured output returned from analyzeSnapshot.
 */
export interface AnalyzeSnapshotResult {
  healthScore: number;
  signalsScore: number;
  orphanCount: number;
  duplicateClusterCount: number;
  schemaCoveragePercent: number;
  ogCoveragePercent: number;
  langCoveragePercent: number;
  pagerankSummary: PagerankSummary;
}

/**
 * Builds the analyzeSnapshot tool for deterministic quality metrics.
 */
export function createAnalyzeSnapshotTool() {
  return {
    description: 'Compute SEO health and signal coverage for an existing snapshot.',
    args: snapshotIdArgsSchema,
    async run(input: unknown): Promise<AnalyzeSnapshotResult> {
      const { snapshotId } = snapshotIdArgsSchema.parse(input);
      requireSnapshot(snapshotId);

      const graph = loadGraphFromSnapshot(snapshotId);
      const metrics = calculateMetrics(graph, 10);
      const issues = collectCrawlIssues(graph, metrics);
      const health = calculateHealthScore(graph.getNodes().length, issues);

      const db = getDb();
      const coverage = db
        .prepare(
          `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN p.html LIKE '%application/ld+json%' THEN 1 ELSE 0 END) AS schemaCount,
            SUM(CASE WHEN p.html LIKE '%property="og:%' OR p.html LIKE "%property='og:%" THEN 1 ELSE 0 END) AS ogCount,
            SUM(CASE WHEN p.html LIKE '%<html lang=%' THEN 1 ELSE 0 END) AS langCount
           FROM pages p
           JOIN snapshots s ON s.site_id = p.site_id
           WHERE s.id = ? AND p.first_seen_snapshot_id <= ?`
        )
        .get(snapshotId, snapshotId) as { total: number; schemaCount: number | null; ogCount: number | null; langCount: number | null };

      const rankValues = graph.getNodes().map((node) => node.pageRank ?? 0).sort((a, b) => a - b);
      const avg = rankValues.length === 0 ? 0 : rankValues.reduce((sum, value) => sum + value, 0) / rankValues.length;
      const p95Index = rankValues.length === 0 ? 0 : Math.max(0, Math.floor(rankValues.length * 0.95) - 1);

      const safePct = (value: number | null | undefined, total: number) =>
        total === 0 ? 0 : Number((((value ?? 0) / total) * 100).toFixed(2));

      return {
        healthScore: health.score,
        signalsScore: Number(metrics.crawlEfficiencyScore.toFixed(2)),
        orphanCount: metrics.orphanPages.length,
        duplicateClusterCount: graph.duplicateClusters.length,
        schemaCoveragePercent: safePct(coverage.schemaCount, coverage.total),
        ogCoveragePercent: safePct(coverage.ogCount, coverage.total),
        langCoveragePercent: safePct(coverage.langCount, coverage.total),
        pagerankSummary: {
          avg: Number(avg.toFixed(6)),
          max: Number((rankValues.at(-1) ?? 0).toFixed(6)),
          p95: Number((rankValues[p95Index] ?? 0).toFixed(6))
        }
      };
    }
  };
}
