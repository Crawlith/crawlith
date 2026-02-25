import { describe, expect, test } from 'vitest';
import { renderAnalysisMarkdown, AnalysisResult, PageAnalysis } from '../src/analysis/analyze.js';

describe('renderAnalysisMarkdown', () => {
  const mockPage: PageAnalysis = {
    url: 'https://example.com/page1',
    status: 200,
    title: { value: 'Page 1', length: 6, status: 'ok' },
    metaDescription: { value: 'Desc 1', length: 6, status: 'ok' },
    h1: { count: 1, status: 'ok', matchesTitle: true },
    content: { wordCount: 100, textHtmlRatio: 0.5, uniqueSentenceCount: 10 },
    thinScore: 0,
    images: { totalImages: 2, missingAlt: 0, emptyAlt: 0 },
    links: { internalLinks: 5, externalLinks: 2, nofollowCount: 0, externalRatio: 0.2 },
    structuredData: { present: true, valid: true, types: ['Article'] },
    seoScore: 90,
    meta: {}
  };

  const mockResult: AnalysisResult = {
    site_summary: {
      pages_analyzed: 2,
      avg_seo_score: 85,
      thin_pages: 0,
      duplicate_titles: 0,
      site_score: 88,
    },
    site_scores: {
      overallScore: 88,
      seoHealthScore: 85,
    } as any, // casting to any to avoid mocking full return type of aggregateSiteScore if complex
    pages: [
      mockPage,
      {
        ...mockPage,
        url: 'https://example.com/page2',
        seoScore: 80,
        thinScore: 10,
        title: { value: 'Page 2', length: 6, status: 'duplicate' },
        metaDescription: { value: 'Desc 2', length: 6, status: 'missing' },
      }
    ],
    active_modules: {
      seo: true,
      content: true,
      accessibility: true,
    },
  };

  test('renders markdown summary correctly', () => {
    const markdown = renderAnalysisMarkdown(mockResult);

    expect(markdown).toContain('# Crawlith SEO Analysis Report');
    expect(markdown).toContain('## 📊 Summary');
    expect(markdown).toContain('- Pages Analyzed: 2');
    expect(markdown).toContain('- Overall Site Score: 88.0');
    expect(markdown).toContain('- Avg SEO Score: 85.0');
    expect(markdown).toContain('- Thin Pages Found: 0');
    expect(markdown).toContain('- Duplicate Titles: 0');
  });

  test('renders page details table header', () => {
    const markdown = renderAnalysisMarkdown(mockResult);

    expect(markdown).toContain('## 📄 Page Details');
    expect(markdown).toContain('| URL | SEO Score | Thin Score | Title Status | Meta Status |');
    expect(markdown).toContain('| :--- | :--- | :--- | :--- | :--- |');
  });

  test('renders page rows correctly', () => {
    const markdown = renderAnalysisMarkdown(mockResult);

    // Check first page row
    expect(markdown).toContain('| https://example.com/page1 | 90 | 0 | ok | ok |');

    // Check second page row
    expect(markdown).toContain('| https://example.com/page2 | 80 | 10 | duplicate | missing |');
  });

  test('handles empty pages list', () => {
    const emptyResult: AnalysisResult = {
      ...mockResult,
      pages: [],
      site_summary: {
        ...mockResult.site_summary,
        pages_analyzed: 0,
      }
    };

    const markdown = renderAnalysisMarkdown(emptyResult);

    expect(markdown).toContain('- Pages Analyzed: 0');
    // Should still contain headers
    expect(markdown).toContain('| URL | SEO Score | Thin Score | Title Status | Meta Status |');
    // Should not contain any data rows
    expect(markdown).not.toContain('| https://example.com');
  });
});
