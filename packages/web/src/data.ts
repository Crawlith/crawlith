// Placeholder to satisfy imports, but file is now largely unused
export const secondaryMetrics = [];
export const issues = [];
export const crawlInfo = { domain: '', timestamp: '', config: {}, healthDelta: 0, snapshotId: '', previousSnapshotId: '' };
export const primaryMetrics = {
    healthScore: { value: 0, delta: 0, status: 'Good' },
    criticalIssues: { total: 0, delta: 0, affectsHighPrPages: 0, breakdown: { notFound: 0, serverErrors: 0, redirectChains: 0, canonicalConflicts: 0 } },
    indexabilityRisk: { total: 0, breakdown: { orphanPages: 0, noindexPages: 0, canonicalIssues: 0, lowInternalLinks: 0 } }
};
export const graphIntelligence = {
    topPagesByPageRank: [],
    crawlDepthDistribution: [],
    duplicateClusterSizeDistribution: [],
    internalLinkDistribution: []
};
