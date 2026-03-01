import { test, expect } from 'vitest';
import { Parser } from '../src/crawler/parser.js';

const parser = new Parser();
const baseUrl = 'https://example.com';

test('extracts links correctly', () => {
  const html = `
    <html>
      <body>
        <a href="/page1">Page 1</a>
        <a href="https://other.com">Other</a>
        <a href="#hash">Hash</a>
        <a href="javascript:void(0)">JS</a>
      </body>
    </html>
  `;
  const result = parser.parse(html, baseUrl, 200);
  const urls = result.links.map(l => l.url);
  expect(urls).toContain('https://example.com/page1');
  expect(urls).toContain('https://other.com/');
  expect(urls).not.toContain('https://example.com/#hash');
  // It also extracts the base URL itself from href="#hash"
  expect(urls).toContain('https://example.com/');
  expect(result.links.length).toBe(3);
});

test('respects nofollow on links', () => {
  const html = `
    <html>
      <body>
        <a href="/page1" rel="nofollow">Page 1</a>
        <a href="/page2">Page 2</a>
      </body>
    </html>
  `;
  const result = parser.parse(html, baseUrl, 200);
  const urls = result.links.map(l => l.url);
  expect(urls).not.toContain('https://example.com/page1');
  expect(urls).toContain('https://example.com/page2');
});

test('respects meta robots nofollow', () => {
  const html = `
    <html>
      <head>
        <meta name="robots" content="nofollow">
      </head>
      <body>
        <a href="/page1">Page 1</a>
      </body>
    </html>
  `;
  const result = parser.parse(html, baseUrl, 200);
  expect(result.nofollow).toBe(true);
  expect(result.links.length).toBe(0);
});

test('detects canonical', () => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="https://example.com/canon">
      </head>
    </html>
  `;
  const result = parser.parse(html, baseUrl, 200);
  expect(result.canonical).toBe('https://example.com/canon');
});

test('detects relative canonical', () => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="/canon">
      </head>
    </html>
  `;
  const result = parser.parse(html, baseUrl, 200);
  expect(result.canonical).toBe('https://example.com/canon');
});

test('detects soft 404', () => {
  const html = `
    <html>
      <head><title>Page Not Found</title></head>
      <body>Sorry, the page you are looking for does not exist.</body>
    </html>
  `;
  const result = parser.parse(html, baseUrl, 200);
  expect(result.soft404Score).toBeGreaterThanOrEqual(0.5);
});

test('content hash ignores scripts', () => {
  const html1 = `
    <html><body><script>var x=1;</script><p>Hello</p></body></html>
  `;
  const html2 = `
    <html><body><script>var x=2;</script><p>Hello</p></body></html>
  `;
  const result1 = parser.parse(html1, baseUrl, 200);
  const result2 = parser.parse(html2, baseUrl, 200);
  expect(result1.contentHash).toBe(result2.contentHash);
});

test('detects meta robots noindex', () => {
  const html = `
    <html>
      <head>
        <meta name="robots" content="noindex, nofollow">
      </head>
    </html>
  `;
  const result = parser.parse(html, baseUrl, 200);
  expect(result.noindex).toBe(true);
  expect(result.nofollow).toBe(true);
});
