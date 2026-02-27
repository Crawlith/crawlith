export const API_PREFIX = '/api';

export interface OverviewData {
  health: {
    score: number;
    status: 'Good' | 'Warning' | 'Critical';
    delta: number;
  };
  totals: {
    discovered: number;
    crawled: number;
    internalLinks: number;
    duplicateClusters: number;
    duplicatePages: number;
    orphanPages: number;
    brokenLinks: number;
    serverErrors: number;
    redirectChains: number;
    noindexPages: number;
    canonicalIssues: number;
    thinContent: number;
    blockedRobots: number;
    crawlTraps: number;
  };
  crawl: {
    durationMs: number;
    avgDepth: number;
    efficiency: number;
  };
}

export interface Issue {
  url: string;
  issueType: string;
  severity: 'Critical' | 'Warning' | 'Info';
  impactScore: number;
  pageRank: number;
  pageRankScore: number;
  lastSeen: string;
}

export interface IssuesResponse {
  total: number;
  page: number;
  pageSize: number;
  results: Issue[];
}

export interface MetricBucket {
  depth?: number;
  size?: number;
  count: number;
}

export interface TopPage {
  url: string;
  pageRank: number;
  authorityScore: number;
  hubScore: number;
}

export interface Snapshot {
  id: number;
  createdAt: string;
  pages?: number;
  health?: number;
  orphanPages?: number;
  thinContent?: number;
}

export interface HistoryTrend {
  id: number;
  date: string;
  pages: number;
  health: number;
  orphans: number;
  brokenLinks: number;
  duplicateClusters: number;
}

export interface SnapshotComparison {
  snapshotA: { id: number, date: string, health: number, pages: number };
  snapshotB: { id: number, date: string, health: number, pages: number };
  diff: {
    pagesAdded: number;
    pagesRemoved: number;
    healthDelta: number;
    newIssues: {
      brokenLinks: { normalized_url: string }[];
    };
    resolvedIssues: {
      brokenLinks: { normalized_url: string }[];
    };
  };
}

export async function fetchOverview(snapshotId?: number): Promise<OverviewData> {
  const query = snapshotId ? `?snapshot=${snapshotId}` : '';
  const res = await fetch(`${API_PREFIX}/overview${query}`);
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json();
}

export async function fetchIssues(snapshotId?: number, severity?: string, search?: string, page: number = 1): Promise<IssuesResponse> {
  const params = new URLSearchParams();
  if (snapshotId) params.append('snapshot', snapshotId.toString());
  if (severity) params.append('severity', severity);
  if (search) params.append('search', search);
  params.append('page', page.toString());

  const res = await fetch(`${API_PREFIX}/issues?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch issues');
  return res.json();
}

export async function fetchTopPages(snapshotId?: number): Promise<{ results: TopPage[] }> {
  const query = snapshotId ? `?snapshot=${snapshotId}` : '';
  const res = await fetch(`${API_PREFIX}/metrics/top-pagerank${query}`);
  if (!res.ok) throw new Error('Failed to fetch top pages');
  return res.json();
}

export async function fetchDepthDistribution(snapshotId?: number): Promise<{ buckets: MetricBucket[] }> {
  const query = snapshotId ? `?snapshot=${snapshotId}` : '';
  const res = await fetch(`${API_PREFIX}/metrics/depth-distribution${query}`);
  if (!res.ok) throw new Error('Failed to fetch depth distribution');
  return res.json();
}

export async function fetchDuplicateClusters(snapshotId?: number): Promise<{ buckets: MetricBucket[] }> {
  const query = snapshotId ? `?snapshot=${snapshotId}` : '';
  const res = await fetch(`${API_PREFIX}/metrics/duplicate-clusters${query}`);
  if (!res.ok) throw new Error('Failed to fetch duplicate clusters');
  return res.json();
}

export async function fetchSnapshots(): Promise<{ results: Snapshot[] }> {
  const res = await fetch(`${API_PREFIX}/snapshots`);
  if (!res.ok) throw new Error('Failed to fetch snapshots');
  return res.json();
}

export async function fetchContext(): Promise<{ siteId: number, snapshotId: number, domain: string, createdAt: string }> {
  const res = await fetch(`${API_PREFIX}/context`);
  if (!res.ok) throw new Error('Failed to fetch context');
  return res.json();
}

export async function fetchHistory(): Promise<{ results: Snapshot[] }> {
  const res = await fetch(`${API_PREFIX}/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function fetchHistoryTrends(): Promise<{ results: HistoryTrend[] }> {
  const res = await fetch(`${API_PREFIX}/history/trends`);
  if (!res.ok) throw new Error('Failed to fetch history trends');
  return res.json();
}

export async function fetchSnapshotComparison(snapshotA: number, snapshotB: number): Promise<SnapshotComparison> {
  const res = await fetch(`${API_PREFIX}/history/compare?snapshotA=${snapshotA}&snapshotB=${snapshotB}`);
  if (!res.ok) throw new Error('Failed to fetch snapshot comparison');
  return res.json();
}

export async function deleteSnapshot(id: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/history/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete snapshot');
  }
}
