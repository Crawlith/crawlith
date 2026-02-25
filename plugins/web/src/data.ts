export const healthMetrics = {
  score: 87,
  brokenLinks: 12,
  orphanPages: 5,
  duplicateClusters: 3,
  pagesCrawled: 1245,
  efficiency: 98.2,
};

export interface Issue {
  id: string;
  url: string;
  type: string;
  severity: 'Critical' | 'Warning' | 'Info';
  lastSeen: string;
}

export const issues: Issue[] = Array.from({ length: 250 }).map((_, i) => ({
  id: `issue-${i}`,
  url: `https://example.com/page-${Math.floor(i / 5)}/sub-${i % 5}`,
  type: i % 10 === 0 ? '404 Not Found' : i % 7 === 0 ? 'Missing H1' : i % 5 === 0 ? 'Thin Content' : 'Low Internal Links',
  severity: i % 10 === 0 ? 'Critical' : i % 7 === 0 ? 'Warning' : 'Info',
  lastSeen: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0],
}));

export const criticalIssues = issues.filter(i => i.severity === 'Critical').slice(0, 5);
