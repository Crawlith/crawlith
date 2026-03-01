import { Graph } from '../graph/graph.js';
import { Metrics } from '../graph/metrics.js';
import { analyzeContent } from '../analysis/content.js';
import { analyzeH1 } from '../analysis/seo.js';
import { analyzeImageAlts } from '../analysis/images.js';
import { analyzeLinks } from '../analysis/links.js';

export const THIN_CONTENT_THRESHOLD = 300;
export const LOW_INTERNAL_LINK_THRESHOLD = 2;
export const EXCESSIVE_INTERNAL_LINK_THRESHOLD = 150;
export const HIGH_EXTERNAL_LINK_RATIO_THRESHOLD = 0.6;
export const OPPORTUNITY_AUTHORITY_THRESHOLD = 0.8;

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

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function healthStatusLabel(score: number, hasCritical: boolean = false): string {
    if (hasCritical && score >= 75) return 'Needs Attention';
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Needs Attention';
    return 'Critical';
}

export function calculateHealthScore(
    totalPages: number,
    issues: Pick<CrawlIssueCounts, 'orphanPages' | 'brokenInternalLinks' | 'redirectChains' | 'duplicateClusters' | 'thinContent' | 'missingH1' | 'accidentalNoindex' | 'canonicalConflicts' | 'lowInternalLinkCount' | 'excessiveInternalLinkCount' | 'blockedByRobots'>,
    weights: HealthScoreWeights = DEFAULT_HEALTH_WEIGHTS
): HealthScoreBreakdown {
    const safePages = Math.max(totalPages, 1);

    const weightedPenalties = {
        orphans: clamp((issues.orphanPages / safePages) * weights.orphans, 0, weights.orphans),
        brokenLinks: clamp((issues.brokenInternalLinks / safePages) * weights.brokenLinks, 0, weights.brokenLinks),
        redirectChains: clamp((issues.redirectChains / safePages) * weights.redirectChains, 0, weights.redirectChains),
        duplicateClusters: clamp((issues.duplicateClusters / safePages) * weights.duplicateClusters, 0, weights.duplicateClusters),
        thinContent: clamp((issues.thinContent / safePages) * weights.thinContent, 0, weights.thinContent),
        missingH1: clamp((issues.missingH1 / safePages) * weights.missingH1, 0, weights.missingH1),
        noindexMisuse: clamp((issues.accidentalNoindex / safePages) * weights.noindexMisuse, 0, weights.noindexMisuse),
        canonicalConflicts: clamp((issues.canonicalConflicts / safePages) * weights.canonicalConflicts, 0, weights.canonicalConflicts),
        lowInternalLinks: clamp((issues.lowInternalLinkCount / safePages) * weights.lowInternalLinks, 0, weights.lowInternalLinks),
        excessiveLinks: clamp((issues.excessiveInternalLinkCount / safePages) * weights.excessiveLinks, 0, weights.excessiveLinks),
        blockedByRobots: clamp((issues.blockedByRobots / safePages) * weights.blockedByRobots, 0, weights.blockedByRobots)
    };

    const totalPenalty = Object.values(weightedPenalties).reduce((sum, value) => sum + value, 0);
    const score = Number(clamp(100 - totalPenalty, 0, 100).toFixed(1));

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
        status: healthStatusLabel(score, hasCritical),
        weightedPenalties,
        weights
    };
}

export function collectCrawlIssues(graph: Graph, metrics: Metrics): CrawlIssueCounts {
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

        const h1 = analyzeH1(node.html, '');
        if (h1.count === 0) {
            missingH1 += 1;
        }

        const content = analyzeContent(node.html);
        if (content.wordCount < THIN_CONTENT_THRESHOLD) {
            thinContent += 1;
        }

        const links = analyzeLinks(node.html, node.url, node.url);
        externalLinks += links.externalLinks;
        if (links.externalRatio > HIGH_EXTERNAL_LINK_RATIO_THRESHOLD) {
            highExternalLinkRatio += 1;
        }

        const imageAlt = analyzeImageAlts(node.html);
        if (imageAlt.missingAlt > 0) {
            imageAltMissing += 1;
        }
    }

    const duplicateClusters = graph.duplicateClusters?.length || 0;
    const cannibalizationClusters = graph.duplicateClusters?.filter((cluster) => cluster.type === 'near').length || 0;

    for (const node of nodes) {
        const authority = node.pageRank || 0;
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
        orphanPages: metrics.orphanPages.length,
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
