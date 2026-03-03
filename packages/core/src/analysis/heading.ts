import { createHash } from 'node:crypto';

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

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'about', 'into', 'over', 'under', 'are', 'was', 'were', 'can', 'has', 'have', 'had', 'you', 'our', 'out', 'all']);
const THIN_SECTION_WORDS = 80;
const HEADING_PATTERN = /<h([1-6])\b[^<>]*>([\s\S]*?)<\/h\1>/gi;
const TITLE_PATTERN = /<title\b[^<>]*>([\s\S]*?)<\/title>/i;

const normalizeText = (input: string) => input.replace(/<[^<>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const normalizeComparable = (input: string) => normalizeText(input).toLowerCase();
const tokenize = (input: string) => normalizeComparable(input).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 2 && !STOPWORDS.has(token));
const stableHash = (input: string) => createHash('sha1').update(input).digest('hex').slice(0, 16);

/**
 * Calculates token-level Jaccard similarity between two text values.
 */
export function jaccardSimilarity(a: string, b: string): number {
    const aSet = new Set(tokenize(a));
    const bSet = new Set(tokenize(b));

    if (!aSet.size || !bSet.size) {
        return 0;
    }

    let intersection = 0;
    for (const token of aSet) {
        if (bSet.has(token)) {
            intersection += 1;
        }
    }

    return intersection / (aSet.size + bSet.size - intersection);
}

/**
 * Performs per-page heading extraction and structural scoring signal generation.
 */
export function analyzeHeadingHealth(html: string, fallbackTitle?: string): LocalPageAnalysis {
    const segments: Array<{ level: HeadingLevel; text: string; start: number; end: number }> = [];
    for (const match of html.matchAll(HEADING_PATTERN)) {
        const level = Number(match[1]) as HeadingLevel;
        segments.push({
            level,
            text: normalizeText(match[2] || ''),
            start: match.index || 0,
            end: (match.index || 0) + match[0].length
        });
    }

    const headingNodes: HeadingNode[] = [];
    const stack: HeadingNode[] = [];
    segments.forEach((segment, index) => {
        const node: HeadingNode = { level: segment.level, text: segment.text, index };
        while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
            stack.pop();
        }
        if (stack.length > 0) {
            node.parentIndex = stack[stack.length - 1].index;
        }
        stack.push(node);
        headingNodes.push(node);
    });

    const sections: SectionMetrics[] = [];
    const pageWords = tokenize(html);
    const frequency = new Map<string, number>();
    for (const word of pageWords) {
        frequency.set(word, (frequency.get(word) || 0) + 1);
    }

    for (let i = 0; i < segments.length; i += 1) {
        const current = segments[i];
        const next = segments[i + 1];
        const textChunk = html.slice(current.end, next ? next.start : html.length);
        const words = tokenize(textChunk);
        const headingTokens = tokenize(current.text);
        const concentration = headingTokens.reduce((sum, token) => sum + (frequency.get(token) || 0), 0);

        sections.push({
            headingIndex: headingNodes[i]?.index ?? i,
            headingText: current.text,
            words: words.length,
            keywordConcentration: words.length > 0 ? Number((concentration / words.length).toFixed(3)) : 0,
            thin: words.length > 0 && words.length < THIN_SECTION_WORDS,
            duplicateRisk: 0
        });
    }

    const levelCounts = [0, 0, 0, 0, 0, 0];
    headingNodes.forEach((node) => {
        levelCounts[node.level - 1] += 1;
    });

    const entropyScore = Number(calculateEntropy(levelCounts).toFixed(3));
    const missingH1 = levelCounts[0] === 0 ? 1 : 0;
    const multipleH1 = levelCounts[0] > 1 ? 1 : 0;

    let hierarchySkips = 0;
    let reverseJumps = 0;
    let volatilitySum = 0;
    for (let i = 1; i < headingNodes.length; i += 1) {
        const delta = headingNodes[i].level - headingNodes[i - 1].level;
        volatilitySum += Math.abs(delta);
        if (delta > 1) {
            hierarchySkips += 1;
        }
        if (delta < -1) {
            reverseJumps += 1;
        }
    }

    const maxDepth = headingNodes.length ? Math.max(...headingNodes.map((node) => node.level)) : 0;
    const avgDepth = headingNodes.length ? Number((headingNodes.reduce((sum, node) => sum + node.level, 0) / headingNodes.length).toFixed(2)) : 0;
    const headingDensity = pageWords.length ? Number((headingNodes.length / pageWords.length).toFixed(4)) : 0;
    const fragmentation = headingNodes.length ? Number((headingNodes.filter((node) => node.level <= 2).length / headingNodes.length).toFixed(3)) : 0;
    const levelVolatility = headingNodes.length > 1 ? Number((volatilitySum / (headingNodes.length - 1)).toFixed(3)) : 0;

    const h1Nodes = headingNodes.filter((node) => node.level === 1);
    const issues: string[] = [];
    if (missingH1) issues.push('Missing H1');
    if (multipleH1) issues.push('Multiple H1 found');
    if (h1Nodes.some((node) => node.text.length < 6)) issues.push('Empty or near-empty H1');

    const title = fallbackTitle || getTitleFromHtml(html);
    if (title && h1Nodes[0] && jaccardSimilarity(title, h1Nodes[0].text) < 0.3) {
        issues.push('H1 diverges from <title>');
    }
    if (hierarchySkips > 0) issues.push(`${hierarchySkips} hierarchy skips detected`);
    if (reverseJumps > 0) issues.push(`${reverseJumps} reverse hierarchy jumps detected`);
    for (const thin of sections.filter((section) => section.thin).slice(0, 2)) {
        issues.push(`Thin section under "${thin.headingText || 'Untitled heading'}"`);
    }
    if (entropyScore > 2.1) issues.push('High structural entropy');
    if (fragmentation > 0.65) issues.push('Section fragmentation is high');

    const h1Norm = normalizeComparable(h1Nodes[0]?.text || '');
    const h2SetHash = stableHash(
        headingNodes
            .filter((node) => node.level === 2)
            .map((node) => normalizeComparable(node.text))
            .filter(Boolean)
            .sort()
            .join('|')
    );
    const patternHash = stableHash(headingNodes.map((node) => node.level).join('>'));

    return {
        url: '',
        headingNodes,
        sections,
        h1Norm,
        h2SetHash,
        patternHash,
        issues,
        metrics: {
            entropy: entropyScore,
            maxDepth,
            avgDepth,
            headingDensity,
            fragmentation,
            levelVolatility,
            hierarchySkips,
            reverseJumps,
            missingH1,
            multipleH1
        }
    };
}

/**
 * Enriches section-level duplicate risk by comparing normalized section signatures across pages.
 */
export function enrichDuplicateRisk(pages: LocalPageAnalysis[]): void {
    const buckets = new Map<string, string[]>();

    for (const page of pages) {
        for (const section of page.sections) {
            const key = stableHash(`${normalizeComparable(section.headingText)}:${section.words}`);
            const bucket = buckets.get(key) || [];
            bucket.push(page.url);
            buckets.set(key, bucket);
        }
    }

    for (const page of pages) {
        for (const section of page.sections) {
            const key = stableHash(`${normalizeComparable(section.headingText)}:${section.words}`);
            const size = (buckets.get(key) || []).length;
            section.duplicateRisk = Number(Math.min(1, (size - 1) / 5).toFixed(3));
        }
    }
}

function calculateEntropy(values: number[]): number {
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) {
        return 0;
    }

    return values.reduce((sum, value) => {
        if (value === 0) {
            return sum;
        }

        const probability = value / total;
        return sum - probability * Math.log2(probability);
    }, 0);
}

function getTitleFromHtml(html: string): string {
    const match = html.match(TITLE_PATTERN);
    return match ? normalizeText(match[1]) : '';
}

/**
 * Coordinates heading analysis across graph nodes and builds report-safe payloads.
 */
export class HeadingHealthService {
    /**
     * Builds page-level payloads plus a snapshot summary for every eligible node.
     */
    public evaluateNodes(nodes: Array<Record<string, any>>): {
        payloadsByUrl: Map<string, HeadingHealthPayload>;
        summary: HeadingHealthSummary;
    } {
        const analyzedPages = this.collectAnalyses(nodes);
        enrichDuplicateRisk(analyzedPages);

        const exactH1Buckets = this.buildBuckets(analyzedPages, (page) => page.h1Norm);
        const h2SetBuckets = this.buildBuckets(analyzedPages, (page) => page.h2SetHash);
        const patternBuckets = this.buildBuckets(analyzedPages, (page) => page.patternHash);
        const similarH1GroupSizes = this.computeSimilarH1GroupSizes(analyzedPages);

        const payloadsByUrl = new Map<string, HeadingHealthPayload>();

        let totalScore = 0;
        let totalMissing = 0;
        let totalMultiple = 0;
        let totalSkips = 0;
        let totalReverseJumps = 0;
        let totalThinSections = 0;
        let totalEntropy = 0;
        let poorPages = 0;

        for (const page of analyzedPages) {
            const duplicateH1GroupSize = page.h1Norm ? exactH1Buckets.get(page.h1Norm)?.length || 1 : 0;
            const similarH1GroupSize = similarH1GroupSizes.get(page.url) || 0;
            const identicalH2SetGroupSize = h2SetBuckets.get(page.h2SetHash)?.length || 1;
            const duplicatePatternGroupSize = patternBuckets.get(page.patternHash)?.length || 1;
            const templateRisk = this.computeTemplateRisk(similarH1GroupSize, identicalH2SetGroupSize, duplicatePatternGroupSize);
            const thinSectionCount = page.sections.filter((section) => section.thin).length;

            const health = this.scoreHealth({
                metrics: page.metrics,
                thinSectionCount,
                duplicateH1GroupSize,
                similarH1GroupSize,
                identicalH2SetGroupSize,
                duplicatePatternGroupSize,
                templateRisk,
                issues: page.issues
            });

            if (health.status === 'Poor') {
                poorPages += 1;
            }

            totalScore += health.score;
            totalMissing += page.metrics.missingH1;
            totalMultiple += page.metrics.multipleH1;
            totalSkips += page.metrics.hierarchySkips;
            totalReverseJumps += page.metrics.reverseJumps;
            totalThinSections += thinSectionCount;
            totalEntropy += page.metrics.entropy;

            payloadsByUrl.set(page.url, {
                score: health.score,
                status: health.status,
                issues: health.issues,
                map: page.headingNodes,
                missing_h1: page.metrics.missingH1,
                multiple_h1: page.metrics.multipleH1,
                entropy: page.metrics.entropy,
                max_depth: page.metrics.maxDepth,
                avg_depth: page.metrics.avgDepth,
                heading_density: page.metrics.headingDensity,
                fragmentation: page.metrics.fragmentation,
                volatility: page.metrics.levelVolatility,
                hierarchy_skips: page.metrics.hierarchySkips,
                reverse_jumps: page.metrics.reverseJumps,
                thin_sections: thinSectionCount,
                duplicate_h1_group: duplicateH1GroupSize,
                similar_h1_group: similarH1GroupSize,
                identical_h2_set_group: identicalH2SetGroupSize,
                duplicate_pattern_group: duplicatePatternGroupSize,
                template_risk: templateRisk
            });
        }

        const evaluatedPages = analyzedPages.length;
        const summary: HeadingHealthSummary = {
            avgScore: evaluatedPages ? Math.round(totalScore / evaluatedPages) : 0,
            evaluatedPages,
            totalMissing,
            totalMultiple,
            totalSkips,
            totalReverseJumps,
            totalThinSections,
            avgEntropy: evaluatedPages ? Number((totalEntropy / evaluatedPages).toFixed(3)) : 0,
            poorPages
        };

        return { payloadsByUrl, summary };
    }

    private collectAnalyses(nodes: Array<Record<string, any>>): LocalPageAnalysis[] {
        const analyses: LocalPageAnalysis[] = [];

        for (const node of nodes) {
            if (node.status < 200 || node.status >= 300 || !node.html || !node.url) {
                continue;
            }

            const analysis = analyzeHeadingHealth(node.html, node.title || node.rawTitle);
            analysis.url = node.url;
            analyses.push(analysis);
        }

        return analyses;
    }

    private buildBuckets(pages: LocalPageAnalysis[], selector: (page: LocalPageAnalysis) => string): Map<string, string[]> {
        const buckets = new Map<string, string[]>();
        for (const page of pages) {
            const key = selector(page);
            if (!key) {
                continue;
            }
            buckets.set(key, [...(buckets.get(key) || []), page.url]);
        }
        return buckets;
    }

    private computeSimilarH1GroupSizes(pages: LocalPageAnalysis[]): Map<string, number> {
        const uniqueH1 = Array.from(new Set(pages.map((page) => page.h1Norm).filter(Boolean)));
        const similarBuckets = new Map<string, Set<string>>();

        for (const h1 of uniqueH1) {
            similarBuckets.set(h1, new Set([h1]));
        }

        for (let i = 0; i < uniqueH1.length; i += 1) {
            for (let j = i + 1; j < uniqueH1.length; j += 1) {
                const a = uniqueH1[i];
                const b = uniqueH1[j];
                if (jaccardSimilarity(a, b) >= 0.7) {
                    similarBuckets.get(a)?.add(b);
                    similarBuckets.get(b)?.add(a);
                }
            }
        }

        const groupSizes = new Map<string, number>();
        for (const page of pages) {
            groupSizes.set(page.url, similarBuckets.get(page.h1Norm)?.size || (page.h1Norm ? 1 : 0));
        }

        return groupSizes;
    }

    private scoreHealth(input: {
        metrics: LocalPageAnalysis['metrics'];
        thinSectionCount: number;
        duplicateH1GroupSize: number;
        similarH1GroupSize: number;
        identicalH2SetGroupSize: number;
        duplicatePatternGroupSize: number;
        templateRisk: number;
        issues: string[];
    }): { score: number; status: 'Healthy' | 'Moderate' | 'Poor'; issues: string[] } {
        let score = 100;
        const metrics = input.metrics;

        if (metrics.missingH1) score -= 20;
        if (metrics.multipleH1) score -= 6;
        score -= metrics.hierarchySkips * 8;
        score -= metrics.reverseJumps * 6;
        score -= Math.round(metrics.entropy * 7);
        score -= Math.round(metrics.fragmentation * 20);
        score -= Math.round(metrics.levelVolatility * 6);
        score -= input.thinSectionCount * 4;

        if (input.duplicateH1GroupSize > 1) score -= Math.min(16, (input.duplicateH1GroupSize - 1) * 3);
        if (input.similarH1GroupSize > 1) score -= Math.min(8, (input.similarH1GroupSize - 1) * 2);
        if (input.identicalH2SetGroupSize > 1) score -= Math.min(10, (input.identicalH2SetGroupSize - 1) * 2);
        if (input.duplicatePatternGroupSize > 1) score -= Math.min(12, (input.duplicatePatternGroupSize - 1) * 2);
        score -= Math.round(input.templateRisk * 12);

        score = Math.max(0, Math.min(100, score));

        return {
            score,
            status: score >= 80 ? 'Healthy' : score >= 55 ? 'Moderate' : 'Poor',
            issues: input.issues
        };
    }

    private computeTemplateRisk(similar: number, h2set: number, pattern: number): number {
        return Number(Math.max(0, Math.min(1, ((similar - 1) * 0.15) + ((h2set - 1) * 0.2) + ((pattern - 1) * 0.2))).toFixed(3));
    }
}
