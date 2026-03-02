import { describe, expect, it } from 'vitest';
import { clusterBySchemaHash, detectOgMismatches, parseSignalsFromHtml } from '../src/signals.js';

describe('signals parsing', () => {
  it('parses json-ld arrays and invalid blocks safely', () => {
    const html = `
      <html lang="en-US"><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>
      <script type="application/ld+json">[{"@type":"FAQPage"}]</script>
      <script type="application/ld+json">{"@type":</script>
      </head><body></body></html>
    `;

    const parsed = parseSignalsFromHtml(html, 'https://example.com/post');
    expect(parsed.hasJsonld).toBe(1);
    expect(parsed.jsonldCount).toBe(3);
    expect(parsed.schemaTypes).toContain('Article');
    expect(parsed.schemaTypes).toContain('FAQPage');
    expect(parsed.brokenJsonld).toBe(1);
  });

  it('detects OG mismatch conditions', () => {
    const mismatches = detectOgMismatches([
      { url: 'a', og_title: 'OG A', page_title: 'Page A', og_url: 'https://a.com/x', canonical_url: 'https://a.com/y' },
      { url: 'b', og_title: 'Same', page_title: 'same', og_url: 'https://b.com/x', canonical_url: 'https://b.com/x' }
    ]);

    expect(mismatches).toEqual([
      { url: 'a', reason: 'title_mismatch' },
      { url: 'a', reason: 'url_mismatch' }
    ]);
  });

  it('clusters identical schema hashes', () => {
    const clusters = clusterBySchemaHash([
      { url: 'https://a.com/1', schema_hash: 'abc' },
      { url: 'https://a.com/2', schema_hash: 'abc' },
      { url: 'https://a.com/3', schema_hash: 'xyz' }
    ]);

    expect(clusters.get('abc')).toEqual(['https://a.com/1', 'https://a.com/2']);
    expect(clusters.get('xyz')).toEqual(['https://a.com/3']);
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
    const parsed = parseSignalsFromHtml(html, 'https://example.com');
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
    const parsed = parseSignalsFromHtml(html, 'https://example.com');
    expect(parsed.twitterCard).toBe('summary_large_image');
    expect(parsed.twitterTitle).toBe('Twitter Title');
    expect(parsed.ogTitle).toBe('OG Title');
    expect(parsed.ogDescription).toBe('OG Desc');
    expect(parsed.pageTitle).toBe('Page Title');
    expect(parsed.hasOg).toBe(1);
  });
});
