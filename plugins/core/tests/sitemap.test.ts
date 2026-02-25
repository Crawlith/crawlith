import { test, expect, beforeEach } from 'vitest';
import { Sitemap } from '../src/crawler/sitemap.js';
import { MockAgent, setGlobalDispatcher } from 'undici';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

test('fetches and parses simple sitemap', async () => {
  const client = mockAgent.get('https://example.com');
  client.intercept({
    path: '/sitemap.xml',
    method: 'GET'
  }).reply(200, `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>https://example.com/page1</loc>
      </url>
      <url>
        <loc>https://example.com/page2</loc>
      </url>
    </urlset>
  `);

  const sitemap = new Sitemap();
  const urls = await sitemap.fetch('https://example.com/sitemap.xml');
  expect(urls).toContain('https://example.com/page1');
  expect(urls).toContain('https://example.com/page2');
  expect(urls.length).toBe(2);
});

test('handles sitemap index recursively', async () => {
  const client = mockAgent.get('https://example.com');

  // Index
  client.intercept({
    path: '/sitemap-index.xml',
    method: 'GET'
  }).reply(200, `
    <?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap>
        <loc>https://example.com/sitemap1.xml</loc>
      </sitemap>
    </sitemapindex>
  `);

  // Child sitemap
  client.intercept({
    path: '/sitemap1.xml',
    method: 'GET'
  }).reply(200, `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>https://example.com/page3</loc>
      </url>
    </urlset>
  `);

  const sitemap = new Sitemap();
  const urls = await sitemap.fetch('https://example.com/sitemap-index.xml');
  expect(urls).toContain('https://example.com/page3');
  expect(urls.length).toBe(1);
});

test('handles invalid xml gracefully', async () => {
  const client = mockAgent.get('https://example.com');
  client.intercept({ path: '/bad.xml', method: 'GET' }).reply(200, 'Not XML');

  const sitemap = new Sitemap();
  const urls = await sitemap.fetch('https://example.com/bad.xml');
  expect(urls.length).toBe(0);
});

test('handles fetch errors gracefully', async () => {
  const client = mockAgent.get('https://example.com');
  client.intercept({ path: '/error.xml', method: 'GET' }).reply(500, 'Error');

  const sitemap = new Sitemap();
  const urls = await sitemap.fetch('https://example.com/error.xml');
  expect(urls.length).toBe(0);
});
