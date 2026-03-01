import { Graph } from '../graph/graph.js';
import { Metrics } from '../graph/metrics.js';
import {
    HealthScoreWeights,
    DEFAULT_HEALTH_WEIGHTS,
    CrawlIssueCounts,
    HealthScoreBreakdown,
    calculateHealthScore,
    collectCrawlIssues,
    THIN_CONTENT_THRESHOLD,
    EXCESSIVE_INTERNAL_LINK_THRESHOLD
} from '../scoring/health.js';

export interface CrawlInsightReport {
    pages: number;
    fetchedPages?: number;
    health: HealthScoreBreakdown;
    issues: CrawlIssueCounts;
    summary: {
        crawlDepth: number;
        internalLinks: number;
        externalLinks: number;
    };
    topAuthorityPages: { url: string; score: number }[];
    hits?: {
        powerNodes: number;
        authorityNodes: number;
        hubNodes: number;
        topAuthorities: { url: string; score: number }[];
        topHubs: { url: string; score: number }[];
    };
}

export function buildCrawlInsightReport(
    graph: Graph,
    metrics: Metrics,
    weights: HealthScoreWeights = DEFAULT_HEALTH_WEIGHTS
): CrawlInsightReport {
    const issues = collectCrawlIssues(graph, metrics);
    const health = calculateHealthScore(metrics.totalPages, issues, weights);

    return {
        pages: metrics.totalPages,
        fetchedPages: metrics.sessionStats?.pagesFetched,
        health,
        issues,
        summary: {
            crawlDepth: metrics.maxDepthFound,
            internalLinks: metrics.totalEdges,
            externalLinks: issues.externalLinks
        },
        topAuthorityPages: metrics.topPageRankPages.slice(0, 10),
        hits: graph.getNodes().some(n => !!n.linkRole) ? {
            powerNodes: graph.getNodes().filter(n => n.linkRole === 'power').length,
            authorityNodes: graph.getNodes().filter(n => n.linkRole === 'authority').length,
            hubNodes: graph.getNodes().filter(n => n.linkRole === 'hub').length,
            topAuthorities: graph.getNodes()
                .filter(n => (n.authorityScore || 0) > 0)
                .sort((a, b) => (b.authorityScore || 0) - (a.authorityScore || 0))
                .slice(0, 5)
                .map(n => ({ url: n.url, score: n.authorityScore! })),
            topHubs: graph.getNodes()
                .filter(n => (n.hubScore || 0) > 0)
                .sort((a, b) => (b.hubScore || 0) - (a.hubScore || 0))
                .slice(0, 5)
                .map(n => ({ url: n.url, score: n.hubScore! }))
        } : undefined
    };
}

export function hasCriticalIssues(report: CrawlInsightReport): boolean {
    const { issues } = report;
    return (
        issues.orphanPages > 0 ||
        issues.brokenInternalLinks > 0 ||
        issues.redirectChains > 0 ||
        issues.duplicateClusters > 0 ||
        issues.canonicalConflicts > 0 ||
        issues.accidentalNoindex > 0 ||
        issues.blockedByRobots > 0
    );
}

function addLine(lines: string[], condition: boolean, text: string) {
    if (condition) lines.push(text);
}

export function renderInsightOutput(report: CrawlInsightReport, snapshotId: number): string {
    const lines: string[] = [];

    // Header
    lines.push(`CRAWLITH — Crawl`);
    lines.push('');
    lines.push(`# ${snapshotId}`);
    lines.push('');
    if (report.fetchedPages !== undefined) {
        if (report.fetchedPages === report.pages) {
            lines.push(`${report.pages} pages crawled`);
        } else {
            lines.push(`${report.fetchedPages} pages fetched / ${report.pages} discovered`);
        }
    } else {
        lines.push(`${report.pages} pages crawled`);
    }
    lines.push('');
    lines.push(
        `Health      ${report.health.score}/100   ${report.health.status}`
    );
    lines.push('');

    // ===== Critical =====
    const critical: string[] = [];

    addLine(critical, report.issues.orphanPages > 0, `${report.issues.orphanPages} orphan pages`);
    addLine(critical, report.issues.redirectChains > 0, `${report.issues.redirectChains} redirect chains`);
    addLine(critical, report.issues.brokenInternalLinks > 0, `${report.issues.brokenInternalLinks} broken internal links`);
    addLine(critical, report.issues.duplicateClusters > 0, `${report.issues.duplicateClusters} near-duplicate clusters`);
    addLine(critical, report.issues.canonicalConflicts > 0, `${report.issues.canonicalConflicts} canonical conflicts`);
    addLine(critical, report.issues.accidentalNoindex > 0, `${report.issues.accidentalNoindex} pages accidentally noindexed`);
    addLine(critical, report.issues.blockedByRobots > 0, `${report.issues.blockedByRobots} pages blocked by robots.txt`);

    if (critical.length > 0) {
        lines.push(`Critical`);
        for (const c of critical) lines.push(`  • ${c}`);
        lines.push('');
    }

    // ===== Warnings (non-zero only) =====
    const warnings: string[] = [];

    addLine(warnings, report.issues.missingH1 > 0, `${report.issues.missingH1} pages missing H1`);
    addLine(warnings, report.issues.thinContent > 0, `${report.issues.thinContent} pages under ${THIN_CONTENT_THRESHOLD} words`);
    addLine(warnings, report.issues.excessiveInternalLinkCount > 0, `${report.issues.excessiveInternalLinkCount} pages with >${EXCESSIVE_INTERNAL_LINK_THRESHOLD} internal links`);
    addLine(warnings, report.issues.lowInternalLinkCount > 0, `${report.issues.lowInternalLinkCount} pages with low internal authority`);
    addLine(warnings, report.issues.highExternalLinkRatio > 0, `${report.issues.highExternalLinkRatio} pages with high external ratio`);
    addLine(warnings, report.issues.imageAltMissing > 0, `${report.issues.imageAltMissing} pages missing image alt`);

    if (warnings.length > 0) {
        lines.push(`Warnings`);
        for (const w of warnings) lines.push(`  • ${w}`);
        lines.push('');
    }

    // ===== Opportunities =====
    const opportunities: string[] = [];

    addLine(opportunities, report.issues.strongPagesUnderLinking > 0, `${report.issues.strongPagesUnderLinking} strong pages could pass more authority`);
    addLine(opportunities, report.issues.cannibalizationClusters > 0, `${report.issues.cannibalizationClusters} cannibalization clusters`);
    addLine(opportunities, report.issues.nearAuthorityThreshold > 0, `${report.issues.nearAuthorityThreshold} pages near authority threshold`);
    addLine(opportunities, report.issues.underlinkedHighAuthorityPages > 0, `${report.issues.underlinkedHighAuthorityPages} underlinked high-authority pages`);

    if (opportunities.length > 0) {
        lines.push(`Opportunities`);
        for (const o of opportunities) lines.push(`  • ${o}`);
        lines.push('');
    }

    // ===== Structural Overview =====
    lines.push(`Structure`);
    lines.push(`  Depth Reached     ${report.summary.crawlDepth}`);
    lines.push(`  Internal Links    ${report.summary.internalLinks}`);
    lines.push(`  External Links    ${report.summary.externalLinks}`);
    lines.push('');

    // ===== Authority =====
    if (report.topAuthorityPages.length > 0) {
        lines.push(`Top Authority`);
        for (const page of report.topAuthorityPages.slice(0, 10)) {
            lines.push(`  ${page.url}   ${page.score.toFixed(3)}`);
        }
        lines.push('');
    }

    // ===== HITS =====
    if (report.hits) {
        lines.push(`HITS`);
        lines.push(
            `  Authorities ${report.hits.authorityNodes}   Hubs ${report.hits.hubNodes}   Power ${report.hits.powerNodes}`
        );

        if (report.hits.topAuthorities.length > 0) {
            lines.push('');
            lines.push(`Top Authorities`);
            report.hits.topAuthorities.slice(0, 5).forEach(p => {
                lines.push(`    ${p.url}   ${p.score.toFixed(3)}`);
            });
        }

        if (report.hits.topHubs.length > 0) {
            lines.push('');
            lines.push(`Top Hubs`);
            report.hits.topHubs.slice(0, 5).forEach(p => {
                lines.push(`    ${p.url}   ${p.score.toFixed(3)}`);
            });
        }

        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}

export function renderScoreBreakdown(health: HealthScoreBreakdown): string {
    return [
        'Health Score Breakdown',
        `weights: ${JSON.stringify(health.weights)}`,
        `penalties: ${JSON.stringify(health.weightedPenalties)}`
    ].join('\n');
}
