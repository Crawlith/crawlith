export interface HealthScoreWeights {
    orphans: number;
    brokenLinks: number;
    redirectChains: number;
    duplicateClusters: number;
    thinContent: number;
    missingH1: number;
    noindexMisuse: number;
    canonicalConflicts: number;
    lowInternalLinks: number;
    excessiveLinks: number;
    blockedByRobots: number;
}

export interface CrawlIssueCounts {
    orphanPages: number;
    brokenInternalLinks: number;
    redirectChains: number;
    duplicateClusters: number;
    canonicalConflicts: number;
    accidentalNoindex: number;
    missingH1: number;
    thinContent: number;
    lowInternalLinkCount: number;
    excessiveInternalLinkCount: number;
    highExternalLinkRatio: number;
    imageAltMissing: number;
    strongPagesUnderLinking: number;
    cannibalizationClusters: number;
    nearAuthorityThreshold: number;
    underlinkedHighAuthorityPages: number;
    externalLinks: number;
    blockedByRobots: number;
}

export interface HealthScoreBreakdown {
    score: number;
    status: string;
    weightedPenalties: Record<keyof HealthScoreWeights, number>;
    weights: HealthScoreWeights;
}

export interface HealthRow {
    score: number;
    weight: number;
    issues_json: string;
}
