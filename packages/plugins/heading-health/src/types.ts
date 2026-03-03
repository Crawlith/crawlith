/**
 * Supported heading levels within HTML content.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Represents a normalized heading node extracted from the DOM.
 */
export interface HeadingNode {
    level: HeadingLevel;
    text: string;
    index: number;
    parentIndex?: number;
}

/**
 * Represents content statistics for a section under a heading.
 */
export interface SectionMetrics {
    headingIndex: number;
    headingText: string;
    words: number;
    keywordConcentration: number;
    thin: boolean;
    duplicateRisk: number;
}

/**
 * Raw heading analysis generated for a single URL.
 */
export interface LocalPageAnalysis {
    url: string;
    headingNodes: HeadingNode[];
    sections: SectionMetrics[];
    h1Norm: string;
    h2SetHash: string;
    patternHash: string;
    issues: string[];
    metrics: {
        entropy: number;
        maxDepth: number;
        avgDepth: number;
        headingDensity: number;
        fragmentation: number;
        levelVolatility: number;
        hierarchySkips: number;
        reverseJumps: number;
        missingH1: number;
        multipleH1: number;
    };
}

/**
 * Final heading-health payload attached to a page node.
 */
export interface HeadingHealthPayload {
    score: number;
    status: 'Healthy' | 'Moderate' | 'Poor';
    issues: string[];
    map: HeadingNode[];
    missing_h1: number;
    multiple_h1: number;
    entropy: number;
    max_depth: number;
    avg_depth: number;
    heading_density: number;
    fragmentation: number;
    volatility: number;
    hierarchy_skips: number;
    reverse_jumps: number;
    thin_sections: number;
    duplicate_h1_group: number;
    similar_h1_group: number;
    identical_h2_set_group: number;
    duplicate_pattern_group: number;
    template_risk: number;
}

/**
 * Snapshot-level summary emitted by the plugin.
 */
export interface HeadingHealthSummary {
    avgScore: number;
    evaluatedPages: number;
    totalMissing: number;
    totalMultiple: number;
    totalSkips: number;
    totalReverseJumps: number;
    totalThinSections: number;
    avgEntropy: number;
    poorPages: number;
}

/**
 * Persisted row shape used by ctx.db.data.find/save.
 */
export interface HeadingHealthRow {
    analysis_json: string;
    score: number;
    status: 'Healthy' | 'Moderate' | 'Poor';
}
