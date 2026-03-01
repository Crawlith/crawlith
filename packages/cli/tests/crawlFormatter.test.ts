import { describe, expect, test } from 'vitest';
import {
  renderInsightOutput,
  hasCriticalIssues,
  buildCrawlInsightReport
} from '../src/commands/crawlFormatter.js';
import { Graph, Metrics, calculateHealthScore, healthStatusLabel } from '@crawlith/core';

function createMetrics(overrides: Partial<Metrics> = {}): Metrics {
  return {
    totalPages: 2,
    totalEdges: 2,
    orphanPages: [],
    nearOrphans: [],
    deepPages: [],
    topAuthorityPages: [],
    averageOutDegree: 1,
    maxDepthFound: 1,
    crawlEfficiencyScore: 1,
    averageDepth: 0.5,
    structuralEntropy: 0,
    topPageRankPages: [
      { url: 'https://example.com/a', score: 0.92 },
      { url: 'https://example.com/b', score: 0.87 }
    ],
    limitReached: false,
    ...overrides
  };
}

describe('health score calculation', () => {
  test('returns deterministic weighted score', () => {
    const score = calculateHealthScore(10, {
      orphanPages: 2,
      brokenInternalLinks: 1,
      redirectChains: 0,
      duplicateClusters: 0,
      thinContent: 0,
      missingH1: 0,
      accidentalNoindex: 0,
      canonicalConflicts: 0,
      lowInternalLinkCount: 0,
      excessiveInternalLinkCount: 0,
      blockedByRobots: 0
    });

    expect(score.score).toBe(80);
    expect(score.status).toBe('Needs Attention');
  });
});

describe('status thresholds', () => {
  test.each([
    [95, 'Excellent'],
    [80, 'Good'],
    [60, 'Needs Attention'],
    [49, 'Critical']
  ])('maps %s to %s', (input, expected) => {
    expect(healthStatusLabel(input)).toBe(expected);
  });
});

describe('section rendering', () => {
  test('renders critical and warning sections in strict order', () => {
    const graph = new Graph();
    graph.addNode('https://example.com/a', 0, 200);
    graph.addNode('https://example.com/b', 1, 200);
    graph.addEdge('https://example.com/a', 'https://example.com/b');
    graph.updateNodeData('https://example.com/a', { pageRank: 0.92, html: '<h1>A</h1><p>hello world</p>' });
    graph.updateNodeData('https://example.com/b', { pageRank: 0.87, html: '<p>no heading</p>', canonical: 'https://example.com/c' });
    graph.duplicateClusters = [{ id: 'x', type: 'near', representative: 'https://example.com/a', size: 2, severity: 'high' }];

    const report = buildCrawlInsightReport(
      graph,
      createMetrics({ orphanPages: ['https://example.com/b'] })
    );

    const output = renderInsightOutput(report, 123);
    expect(output).toContain('CRAWLITH — Crawl');
    expect(output).toContain('Critical');
    expect(output).toContain('Warnings');
    expect(output).toContain('Opportunities');
    expect(output).toContain('Top Authority');

    expect(output.indexOf('Critical')).toBeLessThan(output.indexOf('Warnings'));
    expect(output.indexOf('Warnings')).toBeLessThan(output.indexOf('Top Authority'));
  });

  test('shows no critical issues message when empty', () => {
    const graph = new Graph();
    graph.addNode('https://example.com/a', 0, 200);
    graph.updateNodeData('https://example.com/a', { html: '<h1>A</h1><p>enough words '.repeat(30) + '</p>' });

    const report = buildCrawlInsightReport(graph, createMetrics({ totalPages: 1, topPageRankPages: [] }));
    const output = renderInsightOutput(report, 123);
    expect(output).not.toContain('Critical');
  });
});

describe('critical detection', () => {
  test('returns true when critical counts are present', () => {
    const report = {
      pages: 1,
      health: calculateHealthScore(1, {
        orphanPages: 1,
        brokenInternalLinks: 0,
        redirectChains: 0,
        duplicateClusters: 0,
        thinContent: 0,
        missingH1: 0,
        accidentalNoindex: 0,
        canonicalConflicts: 0,
        lowInternalLinkCount: 0,
        excessiveInternalLinkCount: 0,
        blockedByRobots: 0
      }),
      issues: {
        orphanPages: 1,
        brokenInternalLinks: 0,
        redirectChains: 0,
        duplicateClusters: 0,
        canonicalConflicts: 0,
        accidentalNoindex: 0,
        missingH1: 0,
        thinContent: 0,
        lowInternalLinkCount: 0,
        excessiveInternalLinkCount: 0,
        highExternalLinkRatio: 0,
        imageAltMissing: 0,
        strongPagesUnderLinking: 0,
        cannibalizationClusters: 0,
        nearAuthorityThreshold: 0,
        underlinkedHighAuthorityPages: 0,
        externalLinks: 0,
        blockedByRobots: 0
      },
      summary: { crawlDepth: 1, internalLinks: 0, externalLinks: 0 },
      topAuthorityPages: []
    };

    expect(hasCriticalIssues(report)).toBe(true);
  });
});
