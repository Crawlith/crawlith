import { expect, test } from 'vitest';
import { scorePageSeo, aggregateSiteScore } from '../src/analysis/scoring.js';
import { PageAnalysis } from '../src/analysis/analyze.js';

const basePage: PageAnalysis = {
  url: 'https://example.com',
  status: 200,
  title: { value: 'x'.repeat(55), length: 55, status: 'ok' },
  metaDescription: { value: 'x'.repeat(150), length: 150, status: 'ok' },
  h1: { count: 1, status: 'ok', matchesTitle: false },
  content: { wordCount: 700, textHtmlRatio: 0.3, uniqueSentenceCount: 8 },
  thinScore: 0,
  images: { totalImages: 2, missingAlt: 0, emptyAlt: 0 },
  links: { internalLinks: 5, externalLinks: 2, nofollowCount: 1, externalRatio: 2 / 7 },
  structuredData: { present: true, valid: true, types: ['Article'] },
  seoScore: 0,
  meta: {
    crawlStatus: 'ok'
  }
};

test('page score stays in 0-100', () => {
  expect(scorePageSeo(basePage)).toBeGreaterThanOrEqual(0);
  expect(scorePageSeo(basePage)).toBeLessThanOrEqual(100);

  const badPage: PageAnalysis = {
    ...basePage,
    title: { value: null, length: 0, status: 'missing' },
    metaDescription: { value: null, length: 0, status: 'missing' },
    h1: { count: 0, status: 'critical', matchesTitle: false },
    content: { wordCount: 0, textHtmlRatio: 0, uniqueSentenceCount: 0 },
    thinScore: 100,
    images: { totalImages: 2, missingAlt: 2, emptyAlt: 0 },
    structuredData: { present: false, valid: false, types: [] },
    links: { internalLinks: 0, externalLinks: 9, nofollowCount: 9, externalRatio: 1 }
  };
  expect(scorePageSeo(badPage)).toBeLessThan(50);
});

// test('aggregate site score includes existing metrics signals', () => {
//   const score = aggregateSiteScore({
//     totalPages: 2,
//     totalEdges: 1,
//     orphanPages: ['https://example.com/x'],
//     nearOrphans: [],
//     deepPages: [],
//     topAuthorityPages: [{ url: 'a', authority: 1 }],
//     averageOutDegree: 1,
//     maxDepthFound: 1,
//     crawlEfficiencyScore: 0.8,
//     averageDepth: 1,
//     structuralEntropy: 2,
//     limitReached: false
//   }, [
//     { ...basePage, seoScore: 70 },
//     { ...basePage, seoScore: 90, url: 'https://example.com/2' }
//   ]);

//   expect(score.seoHealthScore).toBe(80);
//   expect(score.overallScore).toBeGreaterThan(0);
//   expect(score.overallScore).toBeLessThanOrEqual(100);
// });
