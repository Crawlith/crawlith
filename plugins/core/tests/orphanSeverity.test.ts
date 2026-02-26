import { describe, expect, test } from 'vitest';
import { annotateOrphans, calculateOrphanSeverity, mapImpactLevel, type SitegraphNode, type SitegraphEdge } from '../src/scoring/orphanSeverity.js';

function baseNode(url: string, overrides: Partial<SitegraphNode> = {}): SitegraphNode {
  return {
    url,
    depth: 1,
    inLinks: 0,
    outLinks: 0,
    status: 200,
    ...overrides
  };
}

describe('orphan detection and severity scoring', () => {
  test('hard orphan detection and homepage exclusion', () => {
    const nodes: SitegraphNode[] = [
      baseNode('https://example.com/', { depth: 0, inLinks: 0 }),
      baseNode('https://example.com/orphan', { inLinks: 0 })
    ];
    const edges: SitegraphEdge[] = [];

    const result = annotateOrphans(nodes, edges, {
      enabled: true,
      severityEnabled: false,
      includeSoftOrphans: false,
      minInbound: 2,
      rootUrl: 'https://example.com/'
    });

    expect(result[0]).toMatchObject({ orphan: false });
    expect(result[1]).toMatchObject({ orphan: true, orphanType: 'hard' });
  });

  test('near orphan threshold override', () => {
    const nodes = [baseNode('https://example.com/near', { inLinks: 2 })];
    const edges: SitegraphEdge[] = [];

    const resultDefault = annotateOrphans(nodes, edges, {
      enabled: true,
      severityEnabled: false,
      includeSoftOrphans: false,
      minInbound: 2
    });
    const resultStrict = annotateOrphans(nodes, edges, {
      enabled: true,
      severityEnabled: false,
      includeSoftOrphans: false,
      minInbound: 1
    });

    expect(resultDefault[0]).toMatchObject({ orphan: true, orphanType: 'near' });
    expect(resultStrict[0]).toMatchObject({ orphan: false });
  });

  test('soft orphan detection only when enabled and inbound only from low-value sources', () => {
    const nodes: SitegraphNode[] = [
      baseNode('https://example.com/tag/seo', { pageType: 'tag', outLinks: 1 }),
      baseNode('https://example.com/list?page=2', { pageType: 'pagination', outLinks: 1 }),
      baseNode('https://example.com/target', { inLinks: 2 }),
      baseNode('https://example.com/normal', { outLinks: 1 })
    ];

    const edges: SitegraphEdge[] = [
      { source: 'https://example.com/tag/seo', target: 'https://example.com/target' },
      { source: 'https://example.com/list?page=2', target: 'https://example.com/target' }
    ];

    const withSoft = annotateOrphans(nodes, edges, {
      enabled: true,
      severityEnabled: false,
      includeSoftOrphans: true,
      minInbound: 1
    });

    const withoutSoft = annotateOrphans(nodes, edges, {
      enabled: true,
      severityEnabled: false,
      includeSoftOrphans: false,
      minInbound: 1
    });

    expect(withSoft.find((n) => n.url.endsWith('/target'))).toMatchObject({ orphan: true, orphanType: 'soft' });
    expect(withoutSoft.find((n) => n.url.endsWith('/target'))).toMatchObject({ orphan: false });
  });

  test('crawl-only orphan detection', () => {
    const nodes = [baseNode('https://example.com/sitemap-only', { inLinks: 0, discoveredViaSitemap: true })];
    const result = annotateOrphans(nodes, [], {
      enabled: true,
      severityEnabled: false,
      includeSoftOrphans: false,
      minInbound: 2
    });

    expect(result[0]).toMatchObject({ orphan: true, orphanType: 'crawl-only' });
  });

  test('severity calculation modifiers and score clamping', () => {
    const high = calculateOrphanSeverity('hard', baseNode('https://example.com/high', {
      inLinks: 0,
      wordCount: 1500,
      hasStructuredData: true,
      depth: 1,
      isProductOrCommercial: true
    }));

    const low = calculateOrphanSeverity('hard', baseNode('https://example.com/low', {
      inLinks: 0,
      wordCount: 120,
      noindex: true,
      duplicateContent: true,
      pageType: 'archive'
    }));

    expect(high).toBe(100);
    expect(low).toBe(80);
  });

  test('impact level mapping', () => {
    expect(mapImpactLevel(0)).toBe('low');
    expect(mapImpactLevel(39)).toBe('low');
    expect(mapImpactLevel(40)).toBe('medium');
    expect(mapImpactLevel(69)).toBe('medium');
    expect(mapImpactLevel(70)).toBe('high');
    expect(mapImpactLevel(89)).toBe('high');
    expect(mapImpactLevel(90)).toBe('critical');
    expect(mapImpactLevel(100)).toBe('critical');
  });

  test('canonical consolidation, robots exclusion, and deterministic JSON output snapshot', () => {
    const nodes: SitegraphNode[] = [
      baseNode('https://example.com/canonical', { inLinks: 0 }),
      baseNode('https://example.com/variant?a=1', { canonicalUrl: 'https://example.com/canonical', inLinks: 1 }),
      baseNode('https://example.com/blocked', { inLinks: 0, robotsExcluded: true }),
      baseNode('https://example.com/redirect-target', { inLinks: 1 })
    ];

    const edges: SitegraphEdge[] = [
      { source: 'https://example.com/redirect-source', target: 'https://example.com/redirect-target' }
    ];

    const options = {
      enabled: true,
      severityEnabled: true,
      includeSoftOrphans: true,
      minInbound: 2
    };

    const first = annotateOrphans(nodes, edges, options);
    const second = annotateOrphans(nodes, edges, options);

    expect(first).toEqual(second);
    expect(first.find((n) => n.url.endsWith('/canonical'))).toMatchObject({ orphan: true, orphanType: 'near' });
    expect(first.find((n) => n.url.endsWith('/blocked'))).toMatchObject({ orphan: false });

    const normalized = JSON.stringify(first, null, 2).replace(/\r\n/g, '\n');
    expect(normalized).toMatchSnapshot();
  });
});
