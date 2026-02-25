import { describe, expect, test } from 'vitest';
import { renderAnalysisCsv, AnalysisResult } from '../src/analysis/analyze.js';

describe('renderAnalysisCsv', () => {
    test('renders CSV with headers', () => {
        const result: AnalysisResult = {
            pages: [],
            site_summary: {
                pages_analyzed: 0,
                avg_seo_score: 0,
                thin_pages: 0,
                duplicate_titles: 0,
                site_score: 0
            },
            site_scores: {} as any,
            active_modules: {
                seo: true,
                content: true,
                accessibility: true
            }
        };

        const csv = renderAnalysisCsv(result);
        expect(csv).toContain('URL,SEO Score,Thin Score,HTTP Status,Title,Title Length,Meta Description,Desc Length,Word Count,Internal Links,External Links');
    });

    test('renders a single page correctly', () => {
        const result: AnalysisResult = {
            pages: [
                {
                    url: 'https://example.com',
                    status: 200,
                    seoScore: 85,
                    thinScore: 10,
                    title: { value: 'Example Domain', length: 14, status: 'ok' },
                    metaDescription: { value: 'This is an example description.', length: 29, status: 'ok' },
                    content: { wordCount: 500 } as any,
                    links: { internalLinks: 5, externalLinks: 2 } as any,
                    h1: {} as any,
                    images: {} as any,
                    structuredData: {} as any,
                    meta: {}
                }
            ],
            site_summary: {
                pages_analyzed: 1,
                avg_seo_score: 85,
                thin_pages: 0,
                duplicate_titles: 0,
                site_score: 85
            },
            site_scores: {} as any,
            active_modules: {
                seo: true,
                content: true,
                accessibility: true
            }
        };

        const csv = renderAnalysisCsv(result);
        const lines = csv.split('\n');
        expect(lines.length).toBe(2);
        expect(lines[1]).toContain('https://example.com,85,10,200,"Example Domain",14,"This is an example description.",29,500,5,2');
    });

    test('escapes quotes in title and meta description', () => {
        const result: AnalysisResult = {
            pages: [
                {
                    url: 'https://example.com/quote',
                    status: 200,
                    seoScore: 90,
                    thinScore: 5,
                    title: { value: 'Example "Quoted" Domain', length: 23, status: 'ok' },
                    metaDescription: { value: 'This description contains "quotes" inside.', length: 42, status: 'ok' },
                    content: { wordCount: 300 } as any,
                    links: { internalLinks: 3, externalLinks: 1 } as any,
                    h1: {} as any,
                    images: {} as any,
                    structuredData: {} as any,
                    meta: {}
                }
            ],
            site_summary: {
                pages_analyzed: 1,
                avg_seo_score: 90,
                thin_pages: 0,
                duplicate_titles: 0,
                site_score: 90
            },
            site_scores: {} as any,
            active_modules: {
                seo: true,
                content: true,
                accessibility: true
            }
        };

        const csv = renderAnalysisCsv(result);
        const lines = csv.split('\n');
        // Expect double quotes to be escaped with double quotes: " -> ""
        // And the whole field wrapped in quotes
        expect(lines[1]).toContain('"Example ""Quoted"" Domain"');
        expect(lines[1]).toContain('"This description contains ""quotes"" inside."');
    });

    test('handles Pending/Limit status (status: 0)', () => {
        const result: AnalysisResult = {
            pages: [
                {
                    url: 'https://example.com/pending',
                    status: 0,
                    seoScore: 0,
                    thinScore: 0,
                    title: { value: null, length: 0, status: 'missing' },
                    metaDescription: { value: null, length: 0, status: 'missing' },
                    content: { wordCount: 0 } as any,
                    links: { internalLinks: 0, externalLinks: 0 } as any,
                    h1: {} as any,
                    images: {} as any,
                    structuredData: {} as any,
                    meta: {}
                }
            ],
            site_summary: {
                pages_analyzed: 1,
                avg_seo_score: 0,
                thin_pages: 0,
                duplicate_titles: 0,
                site_score: 0
            },
            site_scores: {} as any,
            active_modules: {
                seo: true,
                content: true,
                accessibility: true
            }
        };

        const csv = renderAnalysisCsv(result);
        const lines = csv.split('\n');
        expect(lines[1]).toContain('Pending/Limit');
    });

    test('handles missing title and description gracefully', () => {
        const result: AnalysisResult = {
            pages: [
                {
                    url: 'https://example.com/missing',
                    status: 404,
                    seoScore: 0,
                    thinScore: 0,
                    title: { value: undefined as any, length: 0, status: 'missing' },
                    metaDescription: { value: null as any, length: 0, status: 'missing' },
                    content: { wordCount: 0 } as any,
                    links: { internalLinks: 0, externalLinks: 0 } as any,
                    h1: {} as any,
                    images: {} as any,
                    structuredData: {} as any,
                    meta: {}
                }
            ],
            site_summary: {
                pages_analyzed: 1,
                avg_seo_score: 0,
                thin_pages: 0,
                duplicate_titles: 0,
                site_score: 0
            },
            site_scores: {} as any,
            active_modules: {
                seo: true,
                content: true,
                accessibility: true
            }
        };

        const csv = renderAnalysisCsv(result);
        const lines = csv.split('\n');
        // Should produce empty quoted strings ""
        expect(lines[1]).toContain(',"",0,"",0,0,0,0');
    });
});
