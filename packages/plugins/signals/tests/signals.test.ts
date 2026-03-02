import { describe, expect, it } from 'vitest';
import { extractSignalsFromHtml } from '../src/extractor.js';
import { runSignalsAnalysis } from '../src/signalsRunner.js';


class GraphStub {
  private nodes: Array<{ url: string; pageRank?: number; authorityScore?: number; inLinks?: number }> = [];
  addNode(url: string) { this.nodes.push({ url, inLinks: 0 }); }
  updateNodeData(url: string, data: { pageRank?: number; authorityScore?: number; inLinks?: number }) {
    const node = this.nodes.find((item) => item.url === url);
    if (node) Object.assign(node, data);
  }
  getNodes() { return this.nodes; }
}

describe('signals plugin extraction', () => {
  it('parses JSON-LD arrays and flags broken payloads', () => {
    const html = `
      <html lang="en-US"><head>
        <script type="application/ld+json">[{"@type":"Article"},{"@type":"BreadcrumbList"}]</script>
        <script type="application/ld+json">{"@type":</script>
      </head><body></body></html>
    `;

    const parsed = extractSignalsFromHtml('https://example.com/blog/post', html, 'en-US');
    expect(parsed.hasJsonLd).toBe(true);
    expect(parsed.jsonldCount).toBe(2);
    expect(parsed.brokenJsonld).toBe(true);
    expect(parsed.schemaTypes).toEqual(expect.arrayContaining(['Article', 'BreadcrumbList']));
  });

  it('detects OG/title mismatch in post-crawl analysis', () => {
    const graph = new GraphStub();
    graph.addNode('https://example.com/a');
    graph.updateNodeData('https://example.com/a', { pageRank: 0.9, authorityScore: 0.8, inLinks: 20 });

    const records = [extractSignalsFromHtml('https://example.com/a', `
      <html><head>
        <title>Canonical Title</title>
        <meta property="og:title" content="Different OG Title"/>
        <meta property="og:description" content="x"/>
        <meta property="og:image" content="https://example.com/og.png"/>
      </head></html>
    `)];

    const report = runSignalsAnalysis(graph, records);
    expect(report.ogIntelligence.titleMismatches).toBe(1);
  });

  it('clusters identical schema hashes', () => {
    const graph = new GraphStub();
    graph.addNode('https://example.com/p1');
    graph.addNode('https://example.com/p2');

    const jsonld = '<script type="application/ld+json">{"@type":"Product","name":"A"}</script>';
    const a = extractSignalsFromHtml('https://example.com/p1', `<html><head>${jsonld}</head></html>`);
    const b = extractSignalsFromHtml('https://example.com/p2', `<html><head>${jsonld}</head></html>`);

    const report = runSignalsAnalysis(graph, [a, b]);
    expect(report.schemaIntelligence.identicalSchemaClusters.length).toBe(1);
    expect(report.schemaIntelligence.identicalSchemaClusters[0].count).toBe(2);
  });
});
