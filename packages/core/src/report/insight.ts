import { Graph, Metrics } from '@crawlith/core';

export interface CrawlInsightReport {
    pages: number;
    fetchedPages?: number;
    summary: {
        crawlDepth: number;
        internalLinks: number;
        externalLinks: number;
    };
    health?: {
        score: number;
        status: string;
        weightedPenalties: any;
    };
    issues?: any;
    topAuthorityPages: { url: string; score: number }[];
}

export function buildCrawlInsightReport(
    graph: Graph,
    metrics: Metrics,
    healthData?: { health: any, issues: any }
): CrawlInsightReport {
    return {
        pages: metrics.totalPages,
        fetchedPages: metrics.sessionStats?.pagesFetched,
        health: healthData?.health,
        issues: healthData?.issues,
        summary: {
            crawlDepth: metrics.maxDepthFound,
            internalLinks: metrics.totalEdges,
            externalLinks: healthData?.issues?.externalLinks || 0
        },
        topAuthorityPages: metrics.topAuthorityPages.map(p => ({ url: p.url, score: p.authority }))
    };
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

    // Health Score if available
    if (report.health) {
        lines.push(`Score: ${report.health.score} (${report.health.status})`);
        lines.push('');
    }

    // ===== Critical =====
    if (report.issues) {
        const critical: string[] = [];
        const addLine = (arr: string[], condition: boolean, text: string) => condition && arr.push(text);

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

        // ===== Warnings =====
        const warnings: string[] = [];
        addLine(warnings, report.issues.missingH1 > 0, `${report.issues.missingH1} pages missing H1`);
        addLine(warnings, report.issues.thinContent > 0, `${report.issues.thinContent} thin content pages`);
        addLine(warnings, report.issues.excessiveInternalLinkCount > 0, `${report.issues.excessiveInternalLinkCount} pages with excessive links`);
        addLine(warnings, report.issues.imageAltMissing > 0, `${report.issues.imageAltMissing} pages missing image alt`);

        if (warnings.length > 0) {
            lines.push(`Warnings`);
            for (const w of warnings) lines.push(`  • ${w}`);
            lines.push('');
        }
    }

    // ===== Structure =====
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

    return `${lines.join('\n')}\n`;
}

export function renderScoreBreakdown(health: any): string {
    return [
        'Health Score Breakdown',
        `weights: ${JSON.stringify(health.weights)}`,
        `penalties: ${JSON.stringify(health.weightedPenalties)}`
    ].join('\n');
}

export function hasCriticalIssues(report: CrawlInsightReport): boolean {
    if (!report.issues) return false;
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
