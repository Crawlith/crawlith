import {
  analyzeContent,
  analyzeH1,
  analyzeImageAlts,
  analyzeLinks,
  Graph,
  Metrics,

} from '@crawlith/core';

const THIN_CONTENT_THRESHOLD = 300;
const LOW_INTERNAL_LINK_THRESHOLD = 2;
const EXCESSIVE_INTERNAL_LINK_THRESHOLD = 150;
const HIGH_EXTERNAL_LINK_RATIO_THRESHOLD = 0.6;
const OPPORTUNITY_AUTHORITY_THRESHOLD = 0.8;

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
  orphans: 20,
  brokenLinks: 20,
  redirectChains: 10,
  duplicateClusters: 15,
  thinContent: 10,
  missingH1: 10,
  noindexMisuse: 10,
  canonicalConflicts: 5,
  lowInternalLinks: 10,
  excessiveLinks: 5,
  blockedByRobots: 25
};

export interface SitegraphIssueCounts {
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

export interface SitegraphInsightReport {
  pages: number;
  health: HealthScoreBreakdown;
  issues: SitegraphIssueCounts;
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
  issues: Pick<SitegraphIssueCounts, 'orphanPages' | 'brokenInternalLinks' | 'redirectChains' | 'duplicateClusters' | 'thinContent' | 'missingH1' | 'accidentalNoindex' | 'canonicalConflicts' | 'lowInternalLinkCount' | 'excessiveInternalLinkCount' | 'blockedByRobots'>,
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
  // Determine if there are critical issues for the label
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

export function collectSitegraphIssues(graph: Graph, metrics: Metrics): SitegraphIssueCounts {
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
    if (node.crawlStatus === 'blocked') {
      blockedByRobots += 1;
    }
    brokenInternalLinks += node.brokenLinks?.length || 0;
    if ((node.redirectChain?.length || 0) > 1) {
      redirectChains += 1;
    }
    if (node.canonical && node.canonical !== node.url) {
      canonicalConflicts += 1;
    }
    if (node.noindex && node.status >= 200 && node.status < 300) {
      accidentalNoindex += 1;
    }

    if (node.inLinks < LOW_INTERNAL_LINK_THRESHOLD && node.depth > 0) {
      lowInternalLinkCount += 1;
    }
    if (node.outLinks > EXCESSIVE_INTERNAL_LINK_THRESHOLD) {
      excessiveInternalLinkCount += 1;
    }

    if (!node.html) {
      continue;
    }

    const h1 = analyzeH1(node.html, null);
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

export function buildSitegraphInsightReport(
  graph: Graph,
  metrics: Metrics,
  weights: HealthScoreWeights = DEFAULT_HEALTH_WEIGHTS
): SitegraphInsightReport {
  const issues = collectSitegraphIssues(graph, metrics);
  const health = calculateHealthScore(metrics.totalPages, issues, weights);

  return {
    pages: metrics.totalPages,
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

export function hasCriticalIssues(report: SitegraphInsightReport): boolean {
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
export function renderInsightOutput(report: SitegraphInsightReport, snapshotId: number): string {
  const lines: string[] = [];

  // Header
  lines.push(`CRAWLITH — Sitegraph`);
  lines.push('');
  lines.push(`# ${snapshotId}`);
  lines.push('');
  lines.push(`${report.pages} pages crawled`);
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