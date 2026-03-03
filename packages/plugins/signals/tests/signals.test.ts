import { describe, expect, it } from 'vitest';
import { SignalsService } from '../src/Service.js';

const service = new SignalsService();

describe('signals service', () => {
  it('parses json-ld arrays and invalid blocks safely', () => {
    const html = `
      <html lang="en-US"><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>
      <script type="application/ld+json">[{"@type":"FAQPage"}]</script>
      <script type="application/ld+json">{"@type":</script>
      </head><body></body></html>
    `;

    const parsed = service.parseSignalsFromHtml(html, 'https://example.com/post');
    expect(parsed.hasJsonld).toBe(1);
    expect(parsed.jsonldCount).toBe(3);
    expect(parsed.schemaTypes).toContain('Article');
    expect(parsed.schemaTypes).toContain('FAQPage');
    expect(parsed.brokenJsonld).toBe(1);
  });

  it('detects OG mismatch conditions', () => {
    const mismatches = service.detectOgMismatches([
      {
        url: 'a',
        ogTitle: 'OG A',
        pageTitle: 'Page A',
        ogUrl: 'https://a.com/x',
        canonicalUrl: 'https://a.com/y',
        ogDescription: null,
        ogImage: null,
        twitterTitle: null,
        twitterDescription: null,
        twitterImage: null,
        twitterCard: null,
        hasOg: 1,
        ogHash: null,
        lang: null,
        langBase: null,
        hasLang: 0,
        hasHreflang: 0,
        hreflangCount: 0,
        hasJsonld: 0,
        jsonldCount: 0,
        schemaTypes: [],
        primarySchemaType: null,
        schemaHash: null,
        brokenJsonld: 0
      },
      {
        url: 'b',
        ogTitle: 'Same',
        pageTitle: 'same',
        ogUrl: 'https://b.com/x',
        canonicalUrl: 'https://b.com/x',
        ogDescription: null,
        ogImage: null,
        twitterTitle: null,
        twitterDescription: null,
        twitterImage: null,
        twitterCard: null,
        hasOg: 1,
        ogHash: null,
        lang: null,
        langBase: null,
        hasLang: 0,
        hasHreflang: 0,
        hreflangCount: 0,
        hasJsonld: 0,
        jsonldCount: 0,
        schemaTypes: [],
        primarySchemaType: null,
        schemaHash: null,
        brokenJsonld: 0
      }
    ]);

    expect(mismatches).toEqual([
      { url: 'a', reason: 'title_mismatch' },
      { url: 'a', reason: 'url_mismatch' }
    ]);
  });

  it('clusters identical schema hashes', () => {
    const clusters = service.clusterBySchemaHash([
      service.parseSignalsFromHtml('<html></html>', 'https://a.com/1'),
      { ...service.parseSignalsFromHtml('<html></html>', 'https://a.com/2'), schemaHash: 'abc' },
      { ...service.parseSignalsFromHtml('<html></html>', 'https://a.com/3'), schemaHash: 'abc' },
      { ...service.parseSignalsFromHtml('<html></html>', 'https://a.com/4'), schemaHash: 'xyz' }
    ]);

    expect(clusters.get('abc')).toEqual(['https://a.com/2', 'https://a.com/3']);
    expect(clusters.get('xyz')).toEqual(['https://a.com/4']);
  });

  it('extracts nested schema types recursively', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [{
            "@type": "ListItem",
            "item": { "@type": "Thing", "name": "Item 1" }
          }]
        },
        "mainEntity": {
          "@type": "Article",
          "author": { "@type": "Person", "name": "Author Name" }
        }
      }
      </script>
    `;
    const parsed = service.parseSignalsFromHtml(html, 'https://example.com');
    expect(parsed.schemaTypes).toContain('WebPage');
    expect(parsed.schemaTypes).toContain('BreadcrumbList');
    expect(parsed.schemaTypes).toContain('ListItem');
    expect(parsed.schemaTypes).toContain('Thing');
    expect(parsed.schemaTypes).toContain('Article');
    expect(parsed.schemaTypes).toContain('Person');
  });

  it('extracts twitter and og social tags correctly', () => {
    const html = `
      <title>Page Title</title>
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="Twitter Title">
      <meta property="og:title" content="OG Title">
      <meta property="og:description" content="OG Desc">
    `;
    const parsed = service.parseSignalsFromHtml(html, 'https://example.com');
    expect(parsed.twitterCard).toBe('summary_large_image');
    expect(parsed.twitterTitle).toBe('Twitter Title');
    expect(parsed.ogTitle).toBe('OG Title');
    expect(parsed.ogDescription).toBe('OG Desc');
    expect(parsed.pageTitle).toBe('Page Title');
    expect(parsed.hasOg).toBe(1);
  });

  it('builds summary report with prioritized fixes', () => {
    const records = [
      service.parseSignalsFromHtml('<html><head><title>A</title></head></html>', 'https://a.com'),
      service.parseSignalsFromHtml('<html><head><meta property="og:title" content="B"></head></html>', 'https://b.com')
    ];

    const summary = service.buildReport(records, new Map([
      ['https://a.com', { pagerank: 70, authority: 80 }],
      ['https://b.com', { pagerank: 50, authority: 40 }]
    ]));

    expect(summary).not.toBeNull();
    expect(summary?.coverage.og).toBe(50);
    expect(summary?.highImpactFixes.length).toBeGreaterThan(0);
  });
});
