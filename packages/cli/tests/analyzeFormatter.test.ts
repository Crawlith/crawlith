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

    expect(output).toContain('CRAWLITH — Analyze');
    expect(output).toContain('Critical');
    expect(output).toContain('Warnings');
    expect(output).toContain('Top Pages');
    expect(output.indexOf('Critical')).toBeLessThan(output.indexOf('Warnings'));
  });

  test('critical detector is true when critical issues exist', () => {
    const report = buildAnalyzeInsightReport(base);
    expect(hasAnalyzeCriticalIssues(report)).toBe(true);
  });

  test('renders single page branch when report.pages === 1', () => {
    const singlePageBase = {
      site_summary: {
        pages_analyzed: 1,
        avg_seo_score: 82,
        thin_pages: 0,
        duplicate_titles: 0,
        site_score: 82
      },
      pages: [
        {
          url: 'https://example.com/single',
          status: 200,
          seoScore: 82,
          thinScore: 40,
          title: { value: 'Title', length: 5, status: 'ok' },
          metaDescription: { value: 'Desc', length: 4, status: 'ok' },
          h1: { count: 1, status: 'ok', matchesTitle: true },
          content: { wordCount: 500, textHtmlRatio: 0.15, uniqueSentenceCount: 10 },
          images: { totalImages: 2, missingAlt: 0, emptyAlt: 0 },
          links: { internalLinks: 1, externalLinks: 1, nofollowCount: 0, externalRatio: 0.5 },
          structuredData: { present: true, valid: true, types: ['Article'] },
          meta: { crawlStatus: 'ok' },
          plugins: {}
        }
      ]
    } as any; // Cast as any to avoid needing to deeply mock the full type in a focused test

    const report = buildAnalyzeInsightReport(singlePageBase);
    expect(report.pages).toBe(1);

    const output = renderAnalyzeInsightOutput(report, singlePageBase);

    expect(output).toContain('CRAWLITH — Analyze');
    expect(output).toContain('URL:');
    expect(output).toContain('[H1 Header]');
    expect(output).toContain('[Word Count]');
    expect(output).toContain('[Thin Content]');
    expect(output).toContain('[Links]');
    expect(output).toContain('[Images]');
  });
});
