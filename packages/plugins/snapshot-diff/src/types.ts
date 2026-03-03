/**
 * Parsed flag subset used by the snapshot-diff plugin.
 */
export interface SnapshotDiffFlags {
  incremental?: boolean;
  compare?: unknown;
  format?: string;
  url?: string;
}

/**
 * Output modes supported by the plugin formatter.
 */
export type SnapshotDiffOutputFormat = 'json' | 'pretty';

/**
 * Normalized compare request containing exactly two snapshot IDs.
 */
export interface SnapshotCompareRequest {
  oldSnapshotId: number;
  newSnapshotId: number;
}
