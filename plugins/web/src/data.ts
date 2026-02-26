export interface CrawlConfig {
  depth: number;
  limit: number;
  concurrency: number;
}

export interface CrawlInfo {
  domain: string;
  timestamp: string;
  duration: string;
  config: CrawlConfig;
  snapshotId: string;
  previousSnapshotId: string;
  healthDelta: number;
}

export const crawlInfo: CrawlInfo = {
  domain: 'example.com',
  timestamp: 'Feb 26, 2026 – 2m 41s',
  duration: '2m 41s',
  config: {
    depth: 4,
    limit: 2000,
    concurrency: 5,
  },
  snapshotId: '#14',
  previousSnapshotId: '#13',
  healthDelta: 2,
};

export interface HealthMetric {
  value: number;
  delta?: number;
  unit?: string;
  status?: 'Good' | 'Warning' | 'Critical';
}

export interface PrimaryMetrics {
  healthScore: HealthMetric;
  criticalIssues: {
    total: number;
    delta: number; // percentage
    affectsHighPrPages: number; // PageRank > 0.05
    breakdown: {
      notFound: number;
      serverErrors: number;
      redirectChains: number;
      canonicalConflicts: number;
    };
  };
  indexabilityRisk: {
    total: number;
    breakdown: {
      orphanPages: number;
      noindexPages: number;
      canonicalIssues: number;
      lowInternalLinks: number;
    };
  };
}

export const primaryMetrics: PrimaryMetrics = {
  healthScore: {
    value: 87,
    delta: 2,
    status: 'Good',
  },
  criticalIssues: {
    total: 24,
    delta: -5,
    affectsHighPrPages: 3,
    breakdown: {
      notFound: 12,
      serverErrors: 4,
      redirectChains: 5,
      canonicalConflicts: 3,
    },
  },
  indexabilityRisk: {
    total: 45,
    breakdown: {
      orphanPages: 15,
      noindexPages: 8,
      canonicalIssues: 12,
      lowInternalLinks: 10,
    },
  },
};

export interface SecondaryMetric {
  label: string;
  value: number | string;
  delta?: number;
  unit?: string;
}

export const secondaryMetrics: SecondaryMetric[] = [
  { label: 'Pages Crawled', value: 1245, delta: 42 },
  { label: 'Duplicate Clusters', value: 3, delta: 0 },
  { label: 'Crawl Efficiency', value: 98.2, unit: '%', delta: 1.5 },
  { label: 'Avg Internal Links', value: 12.4, delta: -0.2 },
  { label: 'Avg Crawl Depth', value: 3.2, delta: 0.1 },
];

export interface Issue {
  id: string;
  url: string;
  type: string;
  severity: 'Critical' | 'Warning' | 'Info';
  impactScore: number;
  lastSeen: string;
  pageRank: number;
  clusterId?: string;
  description: string;
  whyItMatters: string;
  howToFix: string;
  internalLinksCount: number;
}

const issueTypes = [
  {
    type: '404 Not Found',
    severity: 'Critical' as const,
    description: 'The page cannot be found on the server.',
    whyItMatters: 'Broken links negatively impact user experience and crawl budget.',
    howToFix: 'Remove links to this page or redirect it to a relevant alternative.',
  },
  {
    type: 'Missing H1',
    severity: 'Warning' as const,
    description: 'The page is missing a main heading (H1 tag).',
    whyItMatters: 'H1 tags help search engines understand the main topic of the page.',
    howToFix: 'Add a concise, descriptive H1 tag that reflects the page content.',
  },
  {
    type: 'Thin Content',
    severity: 'Warning' as const,
    description: 'The page has very little content.',
    whyItMatters: 'Thin content may be viewed as low quality by search engines.',
    howToFix: 'Add more unique, valuable content to the page or consolidate it with other pages.',
  },
  {
    type: 'Low Internal Links',
    severity: 'Info' as const,
    description: 'The page has few internal links pointing to it.',
    whyItMatters: 'Internal links help distribute PageRank and help users navigate.',
    howToFix: 'Link to this page from other relevant pages on your site.',
  },
  {
    type: 'Redirect Chain',
    severity: 'Critical' as const,
    description: 'The URL redirects to another URL which also redirects.',
    whyItMatters: 'Redirect chains slow down page load and waste crawl budget.',
    howToFix: 'Update links to point directly to the final destination URL.',
  },
];

export const issues: Issue[] = Array.from({ length: 250 }).map((_, i) => {
  const issueType = issueTypes[i % issueTypes.length];
  return {
    id: `issue-${i}`,
    url: `https://example.com/section-${Math.floor(i / 10)}/page-${i % 10}`,
    type: issueType.type,
    severity: issueType.severity,
    impactScore: Math.floor(Math.random() * 100),
    lastSeen: new Date(Date.now() - Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
    pageRank: parseFloat(Math.random().toFixed(4)),
    clusterId: i % 20 === 0 ? `cluster-${Math.floor(i / 20)}` : undefined,
    description: issueType.description,
    whyItMatters: issueType.whyItMatters,
    howToFix: issueType.howToFix,
    internalLinksCount: Math.floor(Math.random() * 50),
  };
});

export const criticalIssuesList = issues
  .filter(i => i.severity === 'Critical')
  .sort((a, b) => b.impactScore - a.impactScore)
  .slice(0, 10);

export const graphIntelligence = {
  topPagesByPageRank: Array.from({ length: 10 }).map((_, i) => ({
    url: `https://example.com/important-page-${i}`,
    pageRank: (0.8 - i * 0.05).toFixed(3),
    authorityScore: Math.floor(90 - i * 5),
    hubScore: Math.floor(85 - i * 4),
  })),
  crawlDepthDistribution: [
    { depth: 0, count: 1 },
    { depth: 1, count: 15 },
    { depth: 2, count: 145 },
    { depth: 3, count: 450 },
    { depth: 4, count: 634 },
  ],
  duplicateClusterSizeDistribution: [
    { size: '2', count: 12 },
    { size: '3-5', count: 5 },
    { size: '6-10', count: 2 },
    { size: '10+', count: 1 },
  ],
  internalLinkDistribution: [
    { label: '<3 links', count: 150 },
    { label: '3-10 links', count: 450 },
    { label: '10+ links', count: 645 },
  ],
};
