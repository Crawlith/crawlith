import {
  analyzeContent,
  analyzeH1,
  analyzeImageAlts,
  analyzeLinks,
  Graph,
  GraphNode as Node,
  Metrics
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
  excessiveLinks: 5
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

export function healthStatusLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'Critical';
}

export function calculateHealthScore(
  totalPages: number,
  issues: Pick<SitegraphIssueCounts, 'orphanPages' | 'brokenInternalLinks' | 'redirectChains' | 'duplicateClusters' | 'thinContent' | 'missingH1' | 'accidentalNoindex' | 'canonicalConflicts' | 'lowInternalLinkCount' | 'excessiveInternalLinkCount'>,
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
    excessiveLinks: clamp((issues.excessiveInternalLinkCount / safePages) * weights.excessiveLinks, 0, weights.excessiveLinks)
  };

  const totalPenalty = Object.values(weightedPenalties).reduce((sum, value) => sum + value, 0);
  const score = Number(clamp(100 - totalPenalty, 0, 100).toFixed(1));

  return {
    score,
    status: healthStatusLabel(score),
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

  for (const node of nodes) {
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
    externalLinks
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
    issues.accidentalNoindex > 0
  );
}

function addLine(lines: string[], condition: boolean, text: string) {
  if (condition) lines.push(text);
}

export function renderInsightOutput(report: SitegraphInsightReport): string {
  const lines: string[] = [];

  lines.push(`Pages: ${report.pages} Health Score: ${report.health.score}/100 Status: ${report.health.status}`);
  lines.push('');

  const criticalLines: string[] = [];
  addLine(criticalLines, report.issues.orphanPages > 0, `${report.issues.orphanPages} orphan pages`);
  addLine(criticalLines, report.issues.redirectChains > 0, `${report.issues.redirectChains} redirect chains`);
  addLine(criticalLines, report.issues.brokenInternalLinks > 0, `${report.issues.brokenInternalLinks} broken internal links`);
  addLine(criticalLines, report.issues.duplicateClusters > 0, `${report.issues.duplicateClusters} near-duplicate clusters`);
  addLine(criticalLines, report.issues.canonicalConflicts > 0, `${report.issues.canonicalConflicts} canonical conflicts`);
  addLine(criticalLines, report.issues.accidentalNoindex > 0, `${report.issues.accidentalNoindex} pages accidentally noindexed`);

  if (criticalLines.length > 0) {
    lines.push('CRITICAL (Fix Now)');
    lines.push(...criticalLines);
  } else {
    lines.push('No critical issues found.');
  }
  lines.push('');

  lines.push('WARNINGS');
  lines.push(`${report.issues.missingH1} pages missing H1`);
  lines.push(`${report.issues.thinContent} pages under ${THIN_CONTENT_THRESHOLD} words`);
  lines.push(`${report.issues.excessiveInternalLinkCount} pages with >${EXCESSIVE_INTERNAL_LINK_THRESHOLD} internal links`);
  lines.push(`${report.issues.lowInternalLinkCount} pages with low internal authority`);
  lines.push(`${report.issues.highExternalLinkRatio} pages with high external link ratio`);
  lines.push(`${report.issues.imageAltMissing} pages with missing image alt text`);

  const opportunityLines: string[] = [];
  addLine(opportunityLines, report.issues.strongPagesUnderLinking > 0, `${report.issues.strongPagesUnderLinking} strong pages could pass more link equity`);
  addLine(opportunityLines, report.issues.cannibalizationClusters > 0, `${report.issues.cannibalizationClusters} cannibalization clusters`);
  addLine(opportunityLines, report.issues.nearAuthorityThreshold > 0, `${report.issues.nearAuthorityThreshold} pages close to authority threshold`);
  addLine(opportunityLines, report.issues.underlinkedHighAuthorityPages > 0, `${report.issues.underlinkedHighAuthorityPages} underlinked high-authority pages`);

  if (opportunityLines.length > 0) {
    lines.push('');
    lines.push('OPPORTUNITIES');
    lines.push(...opportunityLines);
  }

  lines.push('');
  lines.push(`Crawl Depth: ${report.summary.crawlDepth} Internal Links: ${report.summary.internalLinks} External Links: ${report.summary.externalLinks}`);
  lines.push('');
  lines.push('Top 10 PageRank Pages');
  report.topAuthorityPages.forEach((page) => {
    lines.push(`${page.url} (Score: ${page.score.toFixed(3)})`);
  });

  if (report.hits) {
    lines.push('');
    lines.push('HITS Analysis');
    lines.push(`Power Nodes: ${report.hits.powerNodes} | Authorities: ${report.hits.authorityNodes} | Hubs: ${report.hits.hubNodes}`);

    if (report.hits.topAuthorities.length > 0) {
      lines.push('  Top Authorities (HITS):');
      report.hits.topAuthorities.forEach(p => {
        lines.push(`    ${p.url} (${p.score.toFixed(3)})`);
      });
    }
    if (report.hits.topHubs.length > 0) {
      lines.push('  Top Hubs (HITS):');
      report.hits.topHubs.forEach(p => {
        lines.push(`    ${p.url} (${p.score.toFixed(3)})`);
      });
    }
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
