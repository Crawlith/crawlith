export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingNode {
    level: HeadingLevel;
    text: string;
    index: number;
    parentIndex?: number;
}

export interface SectionMetrics {
    headingIndex: number;
    headingText: string;
    words: number;
    keywordConcentration: number;
    thin: boolean;
    duplicateRisk: number;
}

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
