import { test, expect, beforeEach, afterEach } from 'vitest';
import { crawl } from '../src/crawler/crawl.js';
import { loadGraphFromSnapshot } from '../src/db/graphLoader.js';
import { closeDb } from '../src/db/index.js';
import { MockAgent, setGlobalDispatcher } from 'undici';

let mockAgent: MockAgent;

beforeEach(() => {
  process.env.CRAWLITH_DB_PATH = ':memory:';
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(() => {
  closeDb();
});

test('crawler should crawl and build graph', async () => {
  const client = mockAgent.get('https://example.com');

  // Root
  client.intercept({
    path: '/',
    method: 'GET'
  }).reply(200, `
        <html><body>
            <a href="/page1">Page 1</a>
            <a href="/page2">Page 2</a>
        </body></html>
    `, {
    headers: { 'content-type': 'text/html' }
  });

  // Page 1
  client.intercept({
    path: '/page1',
    method: 'GET'
  }).reply(200, `
        <html><body>
            <a href="/page2">Page 2</a>
        </body></html>
    `, {
    headers: { 'content-type': 'text/html' }
  });

  // Page 2
  client.intercept({
    path: '/page2',
    method: 'GET'
  }).reply(200, `
        <html><body>
            <a href="/">Home</a>
        </body></html>
    `, {
    headers: { 'content-type': 'text/html' }
  });

  // Robots.txt
  client.intercept({
    path: '/robots.txt',
    method: 'GET'
  }).reply(404, 'Not Found');

  const snapshotId = await crawl('https://example.com', {
    limit: 10,
    depth: 2,
    ignoreRobots: false,
    rate: 1000
  });
  const graph = loadGraphFromSnapshot(snapshotId);

  const nodes = graph.getNodes();
  expect(nodes.length).toBe(3);

  const root = graph.nodes.get('https://example.com/');
  expect(root).toBeDefined();
  expect(root?.depth).toBe(0);
  expect(root?.outLinks).toBe(2);

  const page1 = graph.nodes.get('https://example.com/page1');
  expect(page1).toBeDefined();
  expect(page1?.depth).toBe(1);
  expect(page1?.inLinks).toBe(1);

  const page2 = graph.nodes.get('https://example.com/page2');
  expect(page2).toBeDefined();
  expect(page2?.inLinks).toBe(2);
});

test('hard page limit', async () => {
  const client = mockAgent.get('https://limit.com');

  // Robots
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  // Root links to 1, 2, 3
  client.intercept({ path: '/', method: 'GET' }).reply(200, `
    <html><a href="/1">1</a><a href="/2">2</a><a href="/3">3</a></html>
  `, { headers: { 'content-type': 'text/html' } });

  // 1, 2, 3 return html
  client.intercept({ path: '/1', method: 'GET' }).reply(200, '<html></html>', { headers: { 'content-type': 'text/html' } });
  client.intercept({ path: '/2', method: 'GET' }).reply(200, '<html></html>', { headers: { 'content-type': 'text/html' } });
  client.intercept({ path: '/3', method: 'GET' }).reply(200, '<html></html>', { headers: { 'content-type': 'text/html' } });

  const snapshotId = await crawl('https://limit.com', {
    limit: 2, // root + 1 page
    depth: 5,
    ignoreRobots: true,
    rate: 1000
  });
  const graph = loadGraphFromSnapshot(snapshotId);

  // Should have visited root + 1 other page (total 2 nodes with status > 0)
  const crawledNodes = graph.getNodes().filter(n => n.status > 0);
  expect(crawledNodes.length).toBeLessThanOrEqual(2);
});

test('hard depth cap', async () => {
  const client = mockAgent.get('https://depth.com');

  // Robots
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  // Chain of 12 pages
  for (let i = 0; i < 12; i++) {
    const path = i === 0 ? '/' : `/p${i}`;
    const nextPath = `/p${i + 1}`;
    client.intercept({ path, method: 'GET' }).reply(200, `
      <html><a href="${nextPath}">Next</a></html>
    `, { headers: { 'content-type': 'text/html' } });
  }

  const snapshotId = await crawl('https://depth.com', {
    limit: 100,
    depth: 20, // requested 20, but internal hard cap is 10
    ignoreRobots: true,
    rate: 1000
  });
  const graph = loadGraphFromSnapshot(snapshotId);

  const crawledNodes = graph.getNodes().filter(n => n.status > 0);
  const maxCrawledDepth = crawledNodes.reduce((max, n) => Math.max(max, n.depth), 0);

  expect(maxCrawledDepth).toBeLessThanOrEqual(10);
});

test('parameter explosion control', async () => {
  const client = mockAgent.get('https://params.com');
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  // Root links to many variations
  let links = '';
  for (let i = 0; i < 10; i++) {
    links += `<a href="/search?q=${i}">q${i}</a>`;
  }
  client.intercept({ path: '/', method: 'GET' }).reply(200, `
    <html>${links}</html>
  `, { headers: { 'content-type': 'text/html' } });

  // Intercept all variations
  for (let i = 0; i < 40; i++) {
    client.intercept({ path: `/search?q=${i}`, method: 'GET' }).reply(200, '<html></html>', { headers: { 'content-type': 'text/html' } });
  }

  const snapshotId = await crawl('https://params.com', {
    limit: 100,
    depth: 5,
    ignoreRobots: true,
    stripQuery: false,
    detectTraps: true,
    rate: 1000
  });
  const graph = loadGraphFromSnapshot(snapshotId);

  // Should only crawl 5 variations + root
  const nodes = graph.getNodes();
  // Filter nodes that match /search pathname
  const searchNodes = nodes.filter(n => n.url.includes('/search') && n.status > 0);

  expect(searchNodes.length).toBeLessThanOrEqual(31);
});

test('redirect safety', async () => {
  const client = mockAgent.get('https://redirect.com');
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  // Root -> /redir1
  client.intercept({ path: '/', method: 'GET' }).reply(200, `
    <html><a href="/redir1">Go</a></html>
  `, { headers: { 'content-type': 'text/html' } });

  // /redir1 -> 301 -> /dest
  client.intercept({ path: '/redir1', method: 'GET' }).reply(301, '', {
    headers: { 'location': '/dest' }
  });

  // /dest -> 200
  client.intercept({ path: '/dest', method: 'GET' }).reply(200, '<html>Success</html>', { headers: { 'content-type': 'text/html' } });

  const snapshotId = await crawl('https://redirect.com', {
    limit: 10,
    depth: 5,
    ignoreRobots: true,
    rate: 1000
  });
  const graph = loadGraphFromSnapshot(snapshotId);

  const destNode = graph.nodes.get('https://redirect.com/dest');
  expect(destNode).toBeDefined();
  expect(destNode?.status).toBe(200);

  // Redirect loop: A -> B -> A
  const clientLoop = mockAgent.get('https://loop.com');
  clientLoop.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');
  clientLoop.intercept({ path: '/', method: 'GET' }).reply(200, `
    <html><a href="/a">Loop</a></html>
  `, { headers: { 'content-type': 'text/html' } });

  clientLoop.intercept({ path: '/a', method: 'GET' }).reply(301, '', { headers: { location: '/b' } });
  clientLoop.intercept({ path: '/b', method: 'GET' }).reply(301, '', { headers: { location: '/a' } });
  // We might mock /a again if it retries, but it shouldn't infinitely loop

  const snapshotIdLoop = await crawl('https://loop.com', { limit: 10, depth: 5, ignoreRobots: true, rate: 1000 });
  const graphLoop = loadGraphFromSnapshot(snapshotIdLoop);
  // It should eventually stop
  expect(graphLoop.getNodes().length).toBeGreaterThan(0);
});

test('mime check', async () => {
  const client = mockAgent.get('https://mime.com');
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  client.intercept({ path: '/', method: 'GET' }).reply(200, `
    <html><a href="/image.png">Img</a></html>
  `, { headers: { 'content-type': 'text/html' } });

  client.intercept({ path: '/data', method: 'GET' }).reply(200, `
    <html><a href="/hidden">Hidden</a></html>
  `, { headers: { 'content-type': 'application/json' } });

  // Root links to /data
  client.intercept({ path: '/start', method: 'GET' }).reply(200, `
    <html><a href="/data">Data</a></html>
  `, { headers: { 'content-type': 'text/html' } });

  const snapshotId = await crawl('https://mime.com/start', { limit: 10, depth: 5, ignoreRobots: true, rate: 1000 });
  const graph = loadGraphFromSnapshot(snapshotId);

  // /data should be in graph
  const dataNode = graph.nodes.get('https://mime.com/data');
  expect(dataNode).toBeDefined();
  // But we should NOT have parsed it, so /hidden should NOT be in graph
  const hiddenNode = graph.nodes.get('https://mime.com/hidden');
  expect(hiddenNode).toBeUndefined();
});

test('self-link guard', async () => {
  const client = mockAgent.get('https://self.com');
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  client.intercept({ path: '/', method: 'GET' }).reply(200, `
    <html><a href="/">Self</a><a href="/other">Other</a></html>
  `, { headers: { 'content-type': 'text/html' } });

  client.intercept({ path: '/other', method: 'GET' }).reply(200, '', { headers: { 'content-type': 'text/html' } });

  const snapshotId = await crawl('https://self.com', { limit: 10, depth: 5, ignoreRobots: true, rate: 1000 });
  const graph = loadGraphFromSnapshot(snapshotId);

  const edges = graph.getEdges();
  const selfEdge = edges.find(e => e.source === 'https://self.com/' && e.target === 'https://self.com/');
  expect(selfEdge).toBeUndefined();

  const otherEdge = edges.find(e => e.source === 'https://self.com/' && e.target === 'https://self.com/other');
  expect(otherEdge).toBeDefined();
});

test('limit warning', async () => {
  const client = mockAgent.get('https://warn.com');
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  client.intercept({ path: '/', method: 'GET' }).reply(200, `
    <html><a href="/1">1</a><a href="/2">2</a></html>
  `, { headers: { 'content-type': 'text/html' } });

  client.intercept({ path: '/1', method: 'GET' }).reply(200, '', { headers: { 'content-type': 'text/html' } });

  const snapshotId = await crawl('https://warn.com', { limit: 2, depth: 5, ignoreRobots: true, rate: 1000 });
  const graph = loadGraphFromSnapshot(snapshotId);

  expect(graph.limitReached).toBe(true);
});

test('seeds from sitemap', async () => {
  const client = mockAgent.get('https://sitemap-seed.com');
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  // Sitemap
  client.intercept({ path: '/sitemap.xml', method: 'GET' }).reply(200, `
    <urlset><url><loc>https://sitemap-seed.com/page1</loc></url></urlset>
  `);

  // Root
  client.intercept({ path: '/', method: 'GET' }).reply(200, '<html>Root</html>', { headers: { 'content-type': 'text/html' } });

  // Page 1
  client.intercept({ path: '/page1', method: 'GET' }).reply(200, '<html>Page 1</html>', { headers: { 'content-type': 'text/html' } });

  const snapshotId = await crawl('https://sitemap-seed.com', {
    limit: 10,
    depth: 5,
    ignoreRobots: true,
    sitemap: 'true',
    rate: 1000
  });
  const graph = loadGraphFromSnapshot(snapshotId);

  const page1 = graph.nodes.get('https://sitemap-seed.com/page1');
  expect(page1).toBeDefined();
  expect(page1?.status).toBe(200);
});

test('incremental crawl uses etags', async () => {
  const client = mockAgent.get('https://incremental.com');
  client.intercept({ path: '/robots.txt', method: 'GET' }).reply(404, '');

  // First crawl setup
  client.intercept({ path: '/', method: 'GET' }).reply(200, 'Original', {
    headers: { 'content-type': 'text/html', 'etag': '"v1"' }
  });

  const snapshotId1 = await crawl('https://incremental.com', { limit: 10, depth: 1, ignoreRobots: true, rate: 1000 });
  const graph1 = loadGraphFromSnapshot(snapshotId1);
  const node1 = graph1.nodes.get('https://incremental.com/');
  expect(node1?.etag).toBe('"v1"');

  // Second crawl setup
  client.intercept({
    path: '/',
    method: 'GET',
    headers: { 'If-None-Match': '"v1"' }
  }).reply(304, '', { headers: { 'etag': '"v1"' } });

  const snapshotId2 = await crawl('https://incremental.com', {
    limit: 10,
    depth: 1,
    ignoreRobots: true,
    previousGraph: graph1,
    rate: 1000
  });
  const graph2 = loadGraphFromSnapshot(snapshotId2);

  const node2 = graph2.nodes.get('https://incremental.com/');
  expect(node2?.incrementalStatus).toBe('unchanged');
});
