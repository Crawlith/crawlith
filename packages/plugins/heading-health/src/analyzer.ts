import { createHash } from 'node:crypto';
import type { HeadingLevel, HeadingNode, LocalPageAnalysis, SectionMetrics } from './types.js';

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
