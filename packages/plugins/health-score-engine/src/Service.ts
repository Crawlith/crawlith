import { Graph, analyzeContent, analyzeH1, analyzeImageAlts, analyzeLinks } from '@crawlith/core';
import {
    HealthScoreWeights,
    CrawlIssueCounts,
    HealthScoreBreakdown
} from './types.js';

export const THIN_CONTENT_THRESHOLD = 300;
export const LOW_INTERNAL_LINK_THRESHOLD = 2;
export const EXCESSIVE_INTERNAL_LINK_THRESHOLD = 150;
export const HIGH_EXTERNAL_LINK_RATIO_THRESHOLD = 0.6;
export const OPPORTUNITY_AUTHORITY_THRESHOLD = 0.8;

export const DEFAULT_HEALTH_WEIGHTS: HealthScoreWeights = {
    orphans: 50,
    brokenLinks: 100,
    redirectChains: 20,
    duplicateClusters: 25,
    thinContent: 15,
    missingH1: 10,
    noindexMisuse: 20,
    canonicalConflicts: 10,
    lowInternalLinks: 10,
    excessiveLinks: 5,
    blockedByRobots: 100
};

export class HealthService {
    public calculateHealthScore(
        totalPages: number,
        issues: Pick<CrawlIssueCounts, 'orphanPages' | 'brokenInternalLinks' | 'redirectChains' | 'duplicateClusters' | 'thinContent' | 'missingH1' | 'accidentalNoindex' | 'canonicalConflicts' | 'lowInternalLinkCount' | 'excessiveInternalLinkCount' | 'blockedByRobots'>,
        weights: HealthScoreWeights = DEFAULT_HEALTH_WEIGHTS
    ): HealthScoreBreakdown {
        const safePages = Math.max(totalPages, 1);

        const weightedPenalties = {
            orphans: this.clamp((issues.orphanPages / safePages) * weights.orphans, 0, weights.orphans),
            brokenLinks: this.clamp((issues.brokenInternalLinks / safePages) * weights.brokenLinks, 0, weights.brokenLinks),
            redirectChains: this.clamp((issues.redirectChains / safePages) * weights.redirectChains, 0, weights.redirectChains),
            duplicateClusters: this.clamp((issues.duplicateClusters / safePages) * weights.duplicateClusters, 0, weights.duplicateClusters),
            thinContent: this.clamp((issues.thinContent / safePages) * weights.thinContent, 0, weights.thinContent),
            missingH1: this.clamp((issues.missingH1 / safePages) * weights.missingH1, 0, weights.missingH1),
            noindexMisuse: this.clamp((issues.accidentalNoindex / safePages) * weights.noindexMisuse, 0, weights.noindexMisuse),
            canonicalConflicts: this.clamp((issues.canonicalConflicts / safePages) * weights.canonicalConflicts, 0, weights.canonicalConflicts),
            lowInternalLinks: this.clamp((issues.lowInternalLinkCount / safePages) * weights.lowInternalLinks, 0, weights.lowInternalLinks),
            excessiveLinks: this.clamp((issues.excessiveInternalLinkCount / safePages) * weights.excessiveLinks, 0, weights.excessiveLinks),
            blockedByRobots: this.clamp((issues.blockedByRobots / safePages) * weights.blockedByRobots, 0, weights.blockedByRobots)
        };

        const totalPenalty = Object.values(weightedPenalties).reduce((sum, value) => sum + value, 0);
        const score = Number(this.clamp(100 - totalPenalty, 0, 100).toFixed(1));

        const hasCritical = (
            issues.orphanPages > 0 ||
            issues.brokenInternalLinks > 0 ||
            issues.redirectChains > 0 ||
            issues.duplicateClusters > 0 ||
            issues.canonicalConflicts > 0 ||
            issues.accidentalNoindex > 0 ||
            issues.blockedByRobots > 0
        );

        return {
            score,
            status: this.healthStatusLabel(score, hasCritical),
            weightedPenalties,
            weights
        };
    }

    public collectCrawlIssues(graph: Graph, metrics: any): CrawlIssueCounts {
        const nodes = graph.getNodes();

        let brokenInternalLinks = 0;
        let redirectChains = 0;
        let canonicalConflicts = 0;
        let accidentalNoindex = 0;
        let missingH1 = 0;
        let thinContent = 0;
        let highExternalLinkRatio = 0;
        let imageAltMissing = 0;
        let lowInternalLinkCount = 0;
        let excessiveInternalLinkCount = 0;
        let strongPagesUnderLinking = 0;
        let nearAuthorityThreshold = 0;
        let underlinkedHighAuthorityPages = 0;
        let externalLinks = 0;
        let blockedByRobots = 0;

        for (const node of nodes) {
            if (node.crawlStatus === 'blocked' || node.crawlStatus === 'blocked_by_robots') {
                blockedByRobots += 1;
            }

            const isConfirmedError = node.status >= 400 || (node.status === 0 && (node.crawlStatus === 'network_error' || node.crawlStatus === 'failed_after_retries' || node.securityError || node.crawlStatus === 'fetched_error'));

            if (isConfirmedError) {
                brokenInternalLinks += 1;
            }

            if (node.brokenLinks) {
                const actualBreaks = node.brokenLinks.filter(url => {
                    const target = graph.nodes.get(url);
                    return target && (target.status >= 400 || (target.status === 0 && (target.crawlStatus === 'network_error' || target.crawlStatus === 'failed_after_retries' || target.securityError || target.crawlStatus === 'fetched_error')));
                });
                brokenInternalLinks += actualBreaks.length;
            }

            if ((node.redirectChain?.length || 0) > 1) {
                redirectChains += 1;
            }
            if (node.canonical && node.canonical !== node.url) {
                canonicalConflicts += 1;
            }
            if (node.noindex && node.status >= 200 && node.status < 300) {
                accidentalNoindex += 1;
            }

            if (node.inLinks === 1 && node.depth > 0) {
                lowInternalLinkCount += 1;
            }
            if (node.outLinks > EXCESSIVE_INTERNAL_LINK_THRESHOLD) {
                excessiveInternalLinkCount += 1;
            }

            if (!node.html) {
                continue;
            }

            const h1Res = analyzeH1(node.html, '');
            if (h1Res.count === 0) {
                missingH1 += 1;
            }

            if (node.wordCount != null) {
                if (node.wordCount < THIN_CONTENT_THRESHOLD) {
                    thinContent += 1;
                }
            } else if (node.html) {
                const content = analyzeContent(node.html);
                if (content.wordCount < THIN_CONTENT_THRESHOLD) {
                    thinContent += 1;
                }
            }

            const links = analyzeLinks(node.html || '', node.url, node.url);
            externalLinks += links.externalLinks;
            if (links.externalRatio > HIGH_EXTERNAL_LINK_RATIO_THRESHOLD) {
                highExternalLinkRatio += 1;
            }

            if (node.html) {
                const imageAlt = analyzeImageAlts(node.html);
                if (imageAlt.missingAlt > 0) {
                    imageAltMissing += 1;
                }
            }
        }

        const clusters = (graph as any).contentClusters || metrics.clusters || [];
        const duplicateClusters = clusters.length;
        const cannibalizationClusters = clusters.filter((cluster: any) => cluster.risk === 'high' || cluster.type === 'near').length;

        for (const node of nodes) {
            // Since PageRank is now a plugin, we use in-links as a basic authority signal here
            // or we could check ctx.metadata.pagerank if we want to be more integrated.
            // For now, let's use in-links normalized against hypothetical max.
            const authority = node.inLinks > 5 ? 0.8 : 0.2;
            if (authority >= OPPORTUNITY_AUTHORITY_THRESHOLD && node.outLinks < 3) {
                strongPagesUnderLinking += 1;
            }
            if (authority >= 0.65 && authority < OPPORTUNITY_AUTHORITY_THRESHOLD) {
                nearAuthorityThreshold += 1;
            }
            if (authority >= OPPORTUNITY_AUTHORITY_THRESHOLD && node.inLinks < LOW_INTERNAL_LINK_THRESHOLD) {
                underlinkedHighAuthorityPages += 1;
            }
        }

        return {
            orphanPages: metrics.orphanPages?.length || 0,
            brokenInternalLinks,
            redirectChains,
            duplicateClusters,
            canonicalConflicts,
            accidentalNoindex,
            missingH1,
            thinContent,
            lowInternalLinkCount,
            excessiveInternalLinkCount,
            highExternalLinkRatio,
            imageAltMissing,
            strongPagesUnderLinking,
            cannibalizationClusters,
            nearAuthorityThreshold,
            underlinkedHighAuthorityPages,
            externalLinks,
            blockedByRobots
        };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
    }

    private healthStatusLabel(score: number, hasCritical: boolean = false): string {
        if (hasCritical && score >= 75) return 'Needs Attention';
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Good';
        if (score >= 50) return 'Needs Attention';
        return 'Critical';
    }
}
