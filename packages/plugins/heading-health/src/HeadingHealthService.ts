import { analyzeHeadingHealth, enrichDuplicateRisk, jaccardSimilarity } from './analyzer.js';
import type { HeadingHealthPayload, HeadingHealthSummary, LocalPageAnalysis } from './types.js';

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
            const templateRisk = computeTemplateRisk(similarH1GroupSize, identicalH2SetGroupSize, duplicatePatternGroupSize);
            const thinSectionCount = page.sections.filter((section) => section.thin).length;

            const health = scoreHealth({
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

    /**
     * Evaluates a single page's heading health directly from raw HTML.
     * Used by the `onPage` hook (page command). Cross-page duplicate signals are omitted
     * since there is only one page to compare against.
     */
    public evaluateSinglePage(url: string, html: string): HeadingHealthPayload {
        const analysis = analyzeHeadingHealth(html);
        analysis.url = url;

        const thinSectionCount = analysis.sections.filter((section) => section.thin).length;
        const health = scoreHealth({
            metrics: analysis.metrics,
            thinSectionCount,
            duplicateH1GroupSize: 1,
            similarH1GroupSize: 0,
            identicalH2SetGroupSize: 1,
            duplicatePatternGroupSize: 1,
            templateRisk: 0,
            issues: analysis.issues
        });

        return {
            score: health.score,
            status: health.status,
            issues: health.issues,
            map: analysis.headingNodes,
            missing_h1: analysis.metrics.missingH1,
            multiple_h1: analysis.metrics.multipleH1,
            entropy: analysis.metrics.entropy,
            max_depth: analysis.metrics.maxDepth,
            avg_depth: analysis.metrics.avgDepth,
            heading_density: analysis.metrics.headingDensity,
            fragmentation: analysis.metrics.fragmentation,
            volatility: analysis.metrics.levelVolatility,
            hierarchy_skips: analysis.metrics.hierarchySkips,
            reverse_jumps: analysis.metrics.reverseJumps,
            thin_sections: thinSectionCount,
            duplicate_h1_group: 1,
            similar_h1_group: 0,
            identical_h2_set_group: 1,
            duplicate_pattern_group: 1,
            template_risk: 0
        };
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
}

function scoreHealth(input: {
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

function computeTemplateRisk(similar: number, h2set: number, pattern: number): number {
    return Number(Math.max(0, Math.min(1, ((similar - 1) * 0.15) + ((h2set - 1) * 0.2) + ((pattern - 1) * 0.2))).toFixed(3));
}
