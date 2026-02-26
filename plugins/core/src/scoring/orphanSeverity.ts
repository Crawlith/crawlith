export type OrphanType = 'hard' | 'near' | 'soft' | 'crawl-only';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CrawlNode {
  url: string;
  depth: number;
  inLinks: number;
  outLinks: number;
  status: number;
  discoveredViaSitemap?: boolean;
  robotsExcluded?: boolean;
  canonicalUrl?: string;
  isHomepage?: boolean;
  wordCount?: number;
  hasStructuredData?: boolean;
  pageType?: string;
  noindex?: boolean;
  duplicateContent?: boolean;
  isProductOrCommercial?: boolean;
}

export interface CrawlEdge {
  source: string;
  target: string;
}

export interface OrphanScoringOptions {
  enabled: boolean;
  severityEnabled: boolean;
  includeSoftOrphans: boolean;
  minInbound: number;
  rootUrl?: string;
}

export type AnnotatedNode = CrawlNode & {
  orphan: boolean;
  orphanType?: OrphanType;
  orphanSeverity?: number;
  impactLevel?: ImpactLevel;
};

const LOW_VALUE_PATTERNS = [
  /[?&](page|p)=\d+/i,
  /\/(page|tag|tags|category|categories)\//i,
  /[?&](q|query|search|filter|sort)=/i,
  /\/search(\/|\?|$)/i
];

function isLowValuePage(node: CrawlNode): boolean {
  const type = (node.pageType || '').toLowerCase();
  if (['pagination', 'tag', 'category', 'filter', 'search', 'archive'].includes(type)) {
    return true;
  }
  if (node.noindex) {
    return true;
  }
  return LOW_VALUE_PATTERNS.some((pattern) => pattern.test(node.url));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function mapImpactLevel(score: number): ImpactLevel {
  if (score <= 39) return 'low';
  if (score <= 69) return 'medium';
  if (score <= 89) return 'high';
  return 'critical';
}

export function calculateOrphanSeverity(orphanType: OrphanType, node: CrawlNode): number {
  let score = 0;

  switch (orphanType) {
    case 'hard':
      score = 90;
      break;
    case 'crawl-only':
      score = 80;
      break;
    case 'near':
      score = node.inLinks <= 1 ? 70 : 60;
      break;
    case 'soft':
      score = 50;
      break;
  }

  let positiveModifier = 0;
  if ((node.wordCount || 0) > 800) positiveModifier += 10;
  if (node.hasStructuredData) positiveModifier += 10;
  if (node.depth <= 2) positiveModifier += 10;
  if (node.isProductOrCommercial) positiveModifier += 10;
  positiveModifier = Math.min(20, positiveModifier);

  let negativeModifier = 0;
  if ((node.wordCount || 0) > 0 && (node.wordCount || 0) < 300) negativeModifier += 20;
  if (node.noindex) negativeModifier += 20;
  if (node.duplicateContent) negativeModifier += 20;
  if ((node.pageType || '').toLowerCase() === 'archive' || (node.pageType || '').toLowerCase() === 'pagination') negativeModifier += 20;
  negativeModifier = Math.min(20, negativeModifier);

  score += positiveModifier;
  score -= negativeModifier;

  return clampScore(score);
}

function consolidateInboundByCanonical(nodes: CrawlNode[]): Map<string, number> {
  const canonicalInbound = new Map<string, number>();
  for (const node of nodes) {
    const canonical = node.canonicalUrl || node.url;
    canonicalInbound.set(canonical, (canonicalInbound.get(canonical) || 0) + node.inLinks);
  }
  return canonicalInbound;
}

export function annotateOrphans(nodes: CrawlNode[], edges: CrawlEdge[], options: OrphanScoringOptions): AnnotatedNode[] {
  if (!options.enabled) {
    return nodes.map((node) => ({ ...node, orphan: false }));
  }

  const canonicalInbound = consolidateInboundByCanonical(nodes);
  const nodeByUrl = new Map(nodes.map((node) => [node.url, node]));

  return nodes.map((node) => {
    const isHomepage = node.isHomepage || (options.rootUrl ? node.url === options.rootUrl : node.depth === 0);
    if (isHomepage || node.robotsExcluded) {
      return { ...node, orphan: false };
    }

    const canonical = node.canonicalUrl || node.url;
    const inbound = canonicalInbound.get(canonical) || 0;

    let orphanType: OrphanType | undefined;

    if (inbound === 0) {
      orphanType = node.discoveredViaSitemap ? 'crawl-only' : 'hard';
    } else if (inbound <= options.minInbound) {
      orphanType = 'near';
    }

    if (!orphanType && options.includeSoftOrphans && inbound > 0) {
      const inboundSources = edges
        .filter((edge) => edge.target === node.url)
        .map((edge) => nodeByUrl.get(edge.source))
        .filter((source): source is CrawlNode => Boolean(source));

      if (inboundSources.length > 0 && inboundSources.every((source) => isLowValuePage(source))) {
        orphanType = 'soft';
      }
    }

    if (!orphanType) {
      return { ...node, orphan: false };
    }

    if (!options.severityEnabled) {
      return {
        ...node,
        orphan: true,
        orphanType
      };
    }

    const orphanSeverity = calculateOrphanSeverity(orphanType, { ...node, inLinks: inbound });

    return {
      ...node,
      orphan: true,
      orphanType,
      orphanSeverity,
      impactLevel: mapImpactLevel(orphanSeverity)
    };
  });
}
