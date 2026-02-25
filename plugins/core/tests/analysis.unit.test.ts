import { describe, expect, test } from 'vitest';
import { analyzeTitle, analyzeMetaDescription, applyDuplicateStatuses, analyzeH1 } from '../src/analysis/seo.js';
import { analyzeContent, calculateThinContentScore } from '../src/analysis/content.js';
import { analyzeStructuredData } from '../src/analysis/structuredData.js';
import { analyzeLinks } from '../src/analysis/links.js';
import { analyzeImageAlts } from '../src/analysis/images.js';

describe('SEO module', () => {
  test('analyze title edge cases', () => {
    expect(analyzeTitle('<html></html>').status).toBe('missing');
    expect(analyzeTitle('<title>short</title>').status).toBe('too_short');
    expect(analyzeTitle(`<title>${'a'.repeat(61)}</title>`).status).toBe('too_long');
    expect(analyzeTitle(`<title>${'a'.repeat(55)}</title>`).status).toBe('ok');
  });

  test('duplicate detection', () => {
    const values = applyDuplicateStatuses([
      { value: 'Same', length: 4, status: 'ok' as const },
      { value: 'same', length: 4, status: 'ok' as const },
      { value: null, length: 0, status: 'missing' as const }
    ]);
    expect(values[0].status).toBe('duplicate');
    expect(values[1].status).toBe('duplicate');
    expect(values[2].status).toBe('missing');
  });

  test('meta description boundaries', () => {
    expect(analyzeMetaDescription('<meta name="description" content="">').status).toBe('missing');
    expect(analyzeMetaDescription('<html></html>').status).toBe('missing');
    expect(analyzeMetaDescription('<meta name="description" content="short">').status).toBe('too_short');
    expect(analyzeMetaDescription(`<meta name="description" content="${'x'.repeat(150)}">`).status).toBe('ok');
    expect(analyzeMetaDescription(`<meta name="description" content="${'x'.repeat(170)}">`).status).toBe('too_long');
  });

  test('h1 variations', () => {
    expect(analyzeH1('<h1>One</h1>', 'Title').status).toBe('ok');
    expect(analyzeH1('<h1>One</h1><h1>Two</h1>', 'Title').status).toBe('warning');
    const noH1 = analyzeH1('<p>none</p>', 'Title');
    expect(noH1.status).toBe('critical');
    const same = analyzeH1('<h1>same</h1>', 'Same');
    expect(same.matchesTitle).toBe(true);
  });
});

describe('content module', () => {
  test('word count strips nav/footer/script/style', () => {
    const html = '<body><nav>skip me</nav><p>keep words here</p><footer>skip</footer><script>var x</script><style>.x{}</style></body>';
    const result = analyzeContent(html);
    expect(result.wordCount).toBe(3);
    expect(result.uniqueSentenceCount).toBe(1);
    expect(result.textHtmlRatio).toBeGreaterThan(0);
  });

  test('thin score boundaries', () => {
    expect(calculateThinContentScore({ wordCount: 600, textHtmlRatio: 0.5, uniqueSentenceCount: 4 }, 0)).toBe(0);
    expect(calculateThinContentScore({ wordCount: 0, textHtmlRatio: 0, uniqueSentenceCount: 1 }, 100)).toBe(100);
  });

  test('content handles malformed/empty html', () => {
    expect(analyzeContent('').wordCount).toBe(0);
    expect(analyzeContent('<div><span>broken').wordCount).toBeGreaterThanOrEqual(1);
  });
});

describe('structured data', () => {
  test('valid and invalid JSON-LD parsing', () => {
    const valid = analyzeStructuredData('<script type="application/ld+json">{"@type":"Article"}</script>');
    expect(valid.present).toBe(true);
    expect(valid.valid).toBe(true);
    expect(valid.types).toContain('Article');

    const invalid = analyzeStructuredData('<script type="application/ld+json">{invalid}</script>');
    expect(invalid.present).toBe(true);
    expect(invalid.valid).toBe(false);

    const missing = analyzeStructuredData('<p>none</p>');
    expect(missing.present).toBe(false);
  });
});

describe('links and images', () => {
  test('link ratio calculation', () => {
    const html = '<a href="/a">A</a><a href="https://other.com">B</a><a href="https://other.com" rel="nofollow">C</a>';
    const links = analyzeLinks(html, 'https://example.com/page', 'https://example.com');
    expect(links.internalLinks).toBe(1);
    expect(links.externalLinks).toBe(2);
    expect(links.nofollowCount).toBe(1);
    expect(links.externalRatio).toBeCloseTo(2 / 3);
  });

  test('link ratio with no links', () => {
    const html = '<div><p>No links here</p></div>';
    const links = analyzeLinks(html, 'https://example.com/page', 'https://example.com');
    expect(links.internalLinks).toBe(0);
    expect(links.externalLinks).toBe(0);
    expect(links.nofollowCount).toBe(0);
    expect(links.externalRatio).toBe(0);
  });

  test('image alt detection', () => {
    const html = '<img src="a"><img src="b" alt=""><img src="c" alt="ok">';
    const imgs = analyzeImageAlts(html);
    expect(imgs.totalImages).toBe(3);
    expect(imgs.missingAlt).toBe(1);
    expect(imgs.emptyAlt).toBe(1);
  });

  test('image alt detection no images', () => {
    const html = '<div><p>No images here</p></div>';
    const imgs = analyzeImageAlts(html);
    expect(imgs.totalImages).toBe(0);
    expect(imgs.missingAlt).toBe(0);
    expect(imgs.emptyAlt).toBe(0);
  });
});
