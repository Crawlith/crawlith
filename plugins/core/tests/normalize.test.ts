import { normalizeUrl } from '../src/crawler/normalize.js';
import { extractLinks } from '../src/crawler/extract.js';
import { test, expect } from 'vitest';

test('normalizeUrl', () => {
  expect(normalizeUrl('https://Example.com/Foo/', '')).toBe('https://example.com/Foo');
  expect(normalizeUrl('http://example.com:80/bar', '')).toBe('http://example.com/bar');
  expect(normalizeUrl('https://example.com/baz#frag', '')).toBe('https://example.com/baz');
  expect(normalizeUrl('https://example.com/qux?a=1', '', { stripQuery: true })).toBe('https://example.com/qux');
  expect(normalizeUrl('https://example.com/qux?a=1', '', { stripQuery: false })).toBe('https://example.com/qux?a=1');
  expect(normalizeUrl('https://example.com/', '')).toBe('https://example.com/');
});

test('extractLinks', () => {
  const html = `
    <html>
      <body>
        <a href="/foo">Foo</a>
        <a href="bar">Bar</a>
        <a href="https://other.com/baz">Baz</a>
        <a href="#top">Top</a>
      </body>
    </html>
  `;
  const links = extractLinks(html, 'https://example.com/page/');
  expect(links).toContain('https://example.com/foo');
  expect(links).toContain('https://example.com/page/bar');
  expect(links).toContain('https://other.com/baz');
  expect(links).not.toContain('https://example.com/page/#top');
  expect(links).toContain('https://example.com/page/'); // #top resolves to base url without fragment
});
test('normalizeUrl: absolute resolution', () => {
  expect(normalizeUrl('/foo', 'https://example.com')).toBe('https://example.com/foo');
  expect(normalizeUrl('bar', 'https://example.com/baz/')).toBe('https://example.com/baz/bar');
  expect(normalizeUrl('//other.com/foo', 'https://example.com')).toBe('https://other.com/foo');
});

test('normalizeUrl: only http/https', () => {
  expect(normalizeUrl('ftp://example.com/file', 'https://example.com')).toBeNull();
  expect(normalizeUrl('mailto:user@example.com', 'https://example.com')).toBeNull();
  expect(normalizeUrl('javascript:alert(1)', 'https://example.com')).toBeNull();
});

test('normalizeUrl: lowercase hostname', () => {
  expect(normalizeUrl('https://EXAMPLE.com/foo', '')).toBe('https://example.com/foo');
});

test('normalizeUrl: remove default ports', () => {
  expect(normalizeUrl('http://example.com:80/foo', '')).toBe('http://example.com/foo');
  expect(normalizeUrl('https://example.com:443/foo', '')).toBe('https://example.com/foo');
  expect(normalizeUrl('http://example.com:8080/foo', '')).toBe('http://example.com:8080/foo');
});

test('normalizeUrl: remove hash fragments', () => {
  expect(normalizeUrl('https://example.com/foo#bar', '')).toBe('https://example.com/foo');
});

test('normalizeUrl: strip query', () => {
  expect(normalizeUrl('https://example.com/foo?a=1&b=2', '', { stripQuery: true })).toBe('https://example.com/foo');
});

test('normalizeUrl: filter tracking params', () => {
  const url = 'https://example.com/foo?utm_source=google&utm_medium=cpc&a=1&fbclid=123';
  expect(normalizeUrl(url, '', { stripQuery: false })).toBe('https://example.com/foo?a=1');

  const url2 = 'https://example.com/foo?gclid=abc&msclkid=def';
  expect(normalizeUrl(url2, '', { stripQuery: false })).toBe('https://example.com/foo');
});

test('normalizeUrl: trailing slash', () => {
  expect(normalizeUrl('https://example.com/foo/', '')).toBe('https://example.com/foo');
  expect(normalizeUrl('https://example.com/', '')).toBe('https://example.com/');
});

test('normalizeUrl: collapse duplicate slashes', () => {
  expect(normalizeUrl('https://example.com/foo//bar', '')).toBe('https://example.com/foo/bar');
  expect(normalizeUrl('https://example.com//foo///bar', '')).toBe('https://example.com/foo/bar');
});

test('normalizeUrl: skip non-HTML assets', () => {
  expect(normalizeUrl('https://example.com/file.pdf', '')).toBeNull();
  expect(normalizeUrl('https://example.com/image.jpg', '')).toBeNull();
  expect(normalizeUrl('https://example.com/image.png', '')).toBeNull();
  expect(normalizeUrl('https://example.com/image.svg', '')).toBeNull();
  expect(normalizeUrl('https://example.com/image.webp', '')).toBeNull();
  expect(normalizeUrl('https://example.com/image.gif', '')).toBeNull();
  expect(normalizeUrl('https://example.com/archive.zip', '')).toBeNull();
  expect(normalizeUrl('https://example.com/data.xml', '')).toBeNull();
  expect(normalizeUrl('https://example.com/data.json', '')).toBeNull();
  expect(normalizeUrl('https://example.com/video.mp4', '')).toBeNull();

  // HTML extensions should pass (or no extension)
  expect(normalizeUrl('https://example.com/page.html', '')).toBe('https://example.com/page.html');
  expect(normalizeUrl('https://example.com/page.htm', '')).toBe('https://example.com/page.htm');
  expect(normalizeUrl('https://example.com/page', '')).toBe('https://example.com/page');
});

test('normalizeUrl: return format', () => {
  const res = normalizeUrl('https://example.com/foo?a=1', '');
  expect(res).toBe('https://example.com/foo?a=1');
});
