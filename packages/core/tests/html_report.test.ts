import { describe, expect, test } from 'vitest';
import { renderAnalysisHtml, AnalysisResult, PageAnalysis } from '../src/analysis/analyze.js';

const mockPage: PageAnalysis = {
  url: 'https://example.com',
  status: 200,
  seoScore: 85,
  thinScore: 10,
  title: { value: 'Example Title', length: 13, status: 'ok' },
  metaDescription: { value: 'Example Desc', length: 12, status: 'ok' },
  h1: { count: 1, status: 'ok', matchesTitle: true },
  content: { wordCount: 500, uniqueSentenceCount: 50, textHtmlRatio: 0.6 },
  images: { totalImages: 2, missingAlt: 0, emptyAlt: 0 },
  links: { internalLinks: 5, externalLinks: 2, nofollowCount: 0, externalRatio: 0.2 },
  structuredData: { present: true, valid: true, types: ['Article'] },
  meta: { canonical: 'https://example.com', noindex: false, nofollow: false }
};

const mockResult: AnalysisResult = {
  site_summary: {
    pages_analyzed: 1,
    avg_seo_score: 85,
    thin_pages: 0,
    duplicate_titles: 0,
    site_score: 90
  },
  site_scores: { overallScore: 90, seoHealthScore: 85 },
  pages: [mockPage],
  active_modules: { seo: true, content: true, accessibility: true }
};

describe('HTML Report Generation', () => {
  test('generates single page report correctly', () => {
    // If pages length is 1, it renders single page report
    const html = renderAnalysisHtml(mockResult);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Analysis for https://example.com');
    expect(html).toContain('Example Title');
    expect(html).toContain('Example Desc');
    expect(html).toContain('500 words');
    expect(html).toContain('<span class="status-ok">Valid</span>');
  });

  test('generates list report correctly', () => {
    // Modify result to have 2 pages to trigger list view
    const listResult: AnalysisResult = {
      ...mockResult,
      pages: [mockPage, { ...mockPage, url: 'https://example.com/2' }]
    };
    const html = renderAnalysisHtml(listResult);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Crawlith Analysis Report');
    expect(html).toContain('Pages: 1'); // site_summary.pages_analyzed is 1 in mockResult
    expect(html).toContain('https://example.com');
    expect(html).toContain('https://example.com/2');
    expect(html).toContain('<td>85</td>'); // seoScore
  });
});
