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
  snapshotId?: number;
}

export interface Issue {
  id?: string;
  url: string;
  issueType: string;
  severity: 'Critical' | 'Warning' | 'Info';
  impactScore: number;
  pageRank: number;
  pageRankScore: number;
  lastSeen: string;
  type?: string;
  internalLinksCount?: number;
  description?: string;
  whyItMatters?: string;
  howToFix?: string;
  clusterId?: string;
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
  run_type?: 'completed' | 'incremental' | 'single';
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
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

// --- New Interfaces for Single Page View ---

export interface TextFieldAnalysis {
  value: string | null;
  length: number;
  status: 'ok' | 'too_long' | 'too_short' | 'missing' | 'duplicate';
}

export interface H1Analysis {
  count: number;
  status: 'ok' | 'critical' | 'warning';
  matchesTitle: boolean;
}

export interface PageDetails {
  identity: {
    url: string;
    status: number;
    canonical: string | null;
    title: TextFieldAnalysis;
    metaDescription: TextFieldAnalysis;
    h1: H1Analysis;
    crawlError?: string | null;
    crawlDate?: string;
  };
  metrics: {
    pageRank: number;
    rawPageRank: number;
    authority: number;
    hub: number;
    depth: number;
    inlinks: number;
    outlinks: number;
  };
  health: {
    status: string;
    criticalCount: number;
    warningCount: number;
    isThinContent: boolean;
    isDuplicate: boolean;
    indexabilityRisk: boolean;
  };
  content: {
    wordCount: number;
    textHtmlRatio: number;
    uniqueSentenceCount: number;
  };
  images: {
    totalImages: number;
    missingAlt: number;
    emptyAlt: number;
  };
  links: {
    internalLinks: number;
    externalLinks: number;
    externalRatio: number;
  };
  structuredData: {
    present: boolean;
    valid: boolean;
    types: string[];
  };
  headingData?: any;
  snapshotId: number;
  latestSnapshotIdForPage?: number;
}

export interface Inlink {
  sourceUrl: string;
  sourcePageRank: number;
  linkType: string;
  followState: string;
}

export interface InlinksResponse {
  total: number;
  page: number;
  pageSize: number;
  results: Inlink[];
}

export interface Outlink {
  targetUrl: string;
  status: number;
  type: string;
  follow: number;
}

export interface OutlinksResponse {
  total: number;
  page: number;
  pageSize: number;
  results: Outlink[];
}

export interface ClusterInfo {
  hasCluster: boolean;
  clusterSize?: number;
  representative?: string;
  similarity?: string;
  similarUrls?: string[];
}

export interface TechnicalSignals {
  redirectChain: string[] | null;
  headers: any[];
  responseTime: number | null;
  contentType: string;
  contentSize: number;
  serverError: boolean;
  status: number;
}

export interface GraphContext {
  centrality: number;
  incoming: { normalized_url: string; pagerank_score: number }[];
  outgoing: { normalized_url: string; pagerank_score: number }[];
  equityRatio: number;
}

/**
 * A node in the snapshot structure graph explorer.
 */
export interface SnapshotGraphNode {
  id: string;
  label: string;
  nodeType: 'section' | 'cluster' | 'url';
  clusterType: 'template' | 'duplicate' | 'content_group' | 'none';
  url?: string;
  depth: number;
  pageRankScore: number;
  inlinks: number;
  outlinks: number;
  health: number;
  size: number;
  role: string | null;
}

/**
 * A directed internal edge in the snapshot structure graph explorer.
 */
export interface SnapshotGraphEdge {
  source: string;
  target: string;
}

/**
 * Snapshot graph payload returned by the API.
 */
export interface SnapshotGraphResponse {
  snapshotId: number;
  level: number;
  nodes: SnapshotGraphNode[];
  edges: SnapshotGraphEdge[];
  meta: {
    totalNodes: number;
    totalEdges: number;
    truncated: boolean;
  };
}

/**
 * Query options supported by the snapshot graph endpoint.
 */
export interface SnapshotGraphQuery {
  snapshotId?: number;
  level?: 1 | 2 | 3;
  includeEdges?: boolean;
  maxNodes?: number;
  maxEdges?: number;
  minPageRank?: number;
  minInlinks?: number;
  minOutlinks?: number;
  role?: 'all' | 'hub' | 'authority' | 'orphan' | string;
  search?: string;
}

// --- Existing Functions ---

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

export async function fetchContext(): Promise<{ siteId: number, snapshotId: number, latestSnapshotId: number, domain: string, createdAt: string }> {
  const res = await fetch(`${API_PREFIX}/context`);
  if (!res.ok) throw new Error('Failed to fetch context');
  return res.json();
}


// --- New Functions for Single Page View ---

export async function fetchPageDetails(url: string, snapshotId?: number): Promise<PageDetails> {
  const params = new URLSearchParams();
  params.append('url', url);
  if (snapshotId) params.append('snapshot', snapshotId.toString());

  const res = await fetch(`${API_PREFIX}/page?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Page not found');
    throw new Error('Failed to fetch page details');
  }
  return res.json();
}

export async function fetchPagePlugins(url: string, snapshotId?: number): Promise<Record<string, any>> {
  const params = new URLSearchParams();
  params.append('url', url);
  if (snapshotId) params.append('snapshot', snapshotId.toString());

  const res = await fetch(`${API_PREFIX}/page/plugins?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch page plugins');
  return res.json();
}

export async function fetchPageInlinks(url: string, page: number = 1, snapshotId?: number): Promise<InlinksResponse> {
  const params = new URLSearchParams();
  params.append('url', url);
  params.append('page', page.toString());
  if (snapshotId) params.append('snapshot', snapshotId.toString());

  const res = await fetch(`${API_PREFIX}/page/inlinks?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch inlinks');
  return res.json();
}

export async function fetchPageOutlinks(url: string, page: number = 1, snapshotId?: number): Promise<OutlinksResponse> {
  const params = new URLSearchParams();
  params.append('url', url);
  params.append('page', page.toString());
  if (snapshotId) params.append('snapshot', snapshotId.toString());

  const res = await fetch(`${API_PREFIX}/page/outlinks?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch outlinks');
  return res.json();
}

export async function fetchPageCluster(url: string, snapshotId?: number): Promise<ClusterInfo> {
  const params = new URLSearchParams();
  params.append('url', url);
  if (snapshotId) params.append('snapshot', snapshotId.toString());

  const res = await fetch(`${API_PREFIX}/page/cluster?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch cluster info');
  return res.json();
}

export async function fetchPageTechnical(url: string, snapshotId?: number): Promise<TechnicalSignals> {
  const params = new URLSearchParams();
  params.append('url', url);
  if (snapshotId) params.append('snapshot', snapshotId.toString());

  const res = await fetch(`${API_PREFIX}/page/technical?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch technical signals');
  return res.json();
}

export async function fetchPageGraphContext(url: string, snapshotId?: number): Promise<GraphContext> {
  const params = new URLSearchParams();
  params.append('url', url);
  if (snapshotId) params.append('snapshot', snapshotId.toString());

  const res = await fetch(`${API_PREFIX}/page/graph-context?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch graph context');
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

export async function crawlPage(url: string): Promise<{ success: boolean, snapshotId: number, message: string }> {
  const res = await fetch(`${API_PREFIX}/page/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to trigger crawl');
  }
  return res.json();
}

/**
 * Fetches a scalable graph projection for a specific snapshot.
 */
export async function fetchSnapshotGraph(query: SnapshotGraphQuery = {}): Promise<SnapshotGraphResponse> {
  const params = new URLSearchParams();

  if (query.level) params.append('level', query.level.toString());
  if (typeof query.includeEdges === 'boolean') params.append('includeEdges', String(query.includeEdges));
  if (query.snapshotId) params.append('snapshot', query.snapshotId.toString());
  if (query.maxNodes) params.append('maxNodes', query.maxNodes.toString());
  if (query.maxEdges) params.append('maxEdges', query.maxEdges.toString());
  if (typeof query.minPageRank === 'number') params.append('minPageRank', query.minPageRank.toString());
  if (typeof query.minInlinks === 'number') params.append('minInlinks', query.minInlinks.toString());
  if (typeof query.minOutlinks === 'number') params.append('minOutlinks', query.minOutlinks.toString());
  if (query.role) params.append('role', query.role);
  if (query.search) params.append('search', query.search);

  const res = await fetch(`${API_PREFIX}/graph/snapshot?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch snapshot graph');
  return res.json();
}

/**
 * Fetches the 1-hop neighborhood for an interacted graph node.
 */
export async function fetchGraphNeighbors(nodeId: string, snapshotId?: number): Promise<{ nodes: SnapshotGraphNode[]; edges: SnapshotGraphEdge[] }> {
  const params = new URLSearchParams();
  params.append('nodeId', nodeId);
  if (snapshotId) params.append('snapshot', snapshotId.toString());

  const res = await fetch(`${API_PREFIX}/graph/neighbors?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch node neighbors');
  return res.json();
}
