import { describe, expect, test } from 'vitest';
import {
  buildAnalyzeInsightReport,
  hasAnalyzeCriticalIssues,
  renderAnalyzeInsightOutput,
  statusLabel
} from '../src/commands/analyzeFormatter.js';

const base = {
  site_summary: {
    pages_analyzed: 2,
    avg_seo_score: 72,
    thin_pages: 1,
    duplicate_titles: 1,
    site_score: 68
  },
  pages: [
    {
      url: 'https://example.com/a',
      status: 200,
      seoScore: 82,
      thinScore: 40,
      title: { status: 'ok' },
      metaDescription: { status: 'ok' },
      h1: { count: 1 },
      content: { wordCount: 500 },
      images: { missingAlt: 0 },
      links: { internalLinks: 1, externalRatio: 0.2 },
      meta: {}
    },
    {
      url: 'https://example.com/b',
      status: 200,
      seoScore: 63,
      thinScore: 90,
      title: { status: 'missing' },
      metaDescription: { status: 'missing' },
      h1: { count: 0 },
      content: { wordCount: 120 },
      images: { missingAlt: 2 },
      links: { internalLinks: 0, externalRatio: 0.8 },
      meta: { noindex: true }
    }
  ]
};

describe('analyze formatter thresholds', () => {
  test.each([
    [95, 'Excellent'],
    [80, 'Good'],
    [50, 'Needs Attention'],
    [40, 'Critical']
  ])('maps %s to %s', (score, expected) => {
    expect(statusLabel(score)).toBe(expected);
  });
});

describe('analyze formatter report', () => {
  test('builds critical and warning counts deterministically', () => {
    const report = buildAnalyzeInsightReport(base);

    expect(report.score).toBe(68);
    expect(report.status).toBe('Needs Attention');
    expect(report.critical.missingTitles).toBe(1);
    expect(report.critical.missingMetaDescriptions).toBe(1);
    expect(report.critical.accidentalNoindex).toBe(1);
    expect(report.critical.severeThinContent).toBe(1);
    expect(report.warnings.missingH1).toBe(1);
    expect(report.warnings.lowWordCount).toBe(1);
  });

  test('renders strict ordered sections', () => {
    const report = buildAnalyzeInsightReport(base);
    const output = renderAnalyzeInsightOutput(report);

    expect(output).toContain('Pages: 2 Health Score: 68/100 Status: Needs Attention');
    expect(output).toContain('CRITICAL (Fix Now)');
    expect(output).toContain('WARNINGS');
    expect(output).toContain('Top 10 Pages by SEO Score');
    expect(output.indexOf('CRITICAL (Fix Now)')).toBeLessThan(output.indexOf('WARNINGS'));
  });

  test('critical detector is true when critical issues exist', () => {
    const report = buildAnalyzeInsightReport(base);
    expect(hasAnalyzeCriticalIssues(report)).toBe(true);
  });
});
