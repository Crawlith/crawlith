import { test, expect, beforeEach, vi } from 'vitest';
import { Sitemap } from '../src/crawler/sitemap.js';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { EngineContext } from '../src/events.js';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

test('performance test: large number of child sitemaps', async () => {
  const client = mockAgent.get('https://example.com');
  const numChildren = 40;

  // Generate sitemap index with many children
  let indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  for (let i = 0; i < numChildren; i++) {
    indexXml += `<sitemap><loc>https://example.com/sitemap${i}.xml</loc></sitemap>`;

    // Stub each child sitemap
    // Adding artificial delay to simulate network latency
    client.intercept({
      path: `/sitemap${i}.xml`,
      method: 'GET'
    }).reply(200, async () => {
      await new Promise(r => setTimeout(r, 10)); // 10ms delay
      return `
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page${i}</loc></url>
        </urlset>
      `;
    });
  }
  indexXml += `</sitemapindex>`;

  client.intercept({
    path: '/sitemap-index.xml',
    method: 'GET'
  }).reply(200, async () => {
    await new Promise(r => setTimeout(r, 10)); // 10ms delay
    return indexXml;
  });

  const sitemap = new Sitemap();
  const start = performance.now();
  const urls = await sitemap.fetch('https://example.com/sitemap-index.xml');
  const end = performance.now();

  const duration = end - start;
  console.log(`Sitemap fetch took ${duration}ms for ${numChildren} children`);

  expect(urls.length).toBe(numChildren);
});
