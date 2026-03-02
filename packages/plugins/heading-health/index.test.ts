import { describe, expect, it } from 'vitest';
import HeadingHealthPlugin from './index.js';
import type { PluginContext } from '@crawlith/core';

describe('heading-health plugin', () => {
  it('computes detailed per-page heading map data and summary metrics', async () => {
    const graph = {
      getNodes() {
        return [
          {
            url: 'https://example.com/a',
            status: 200,
            title: 'Product A Overview',
            html: `
              <html><body>
                <h1>Product A</h1>
                <p>${'intro '.repeat(50)}</p>
                <h3>Features</h3>
                <p>${'feature '.repeat(20)}</p>
                <h2>FAQ</h2>
                <p>${'faq '.repeat(90)}</p>
              </body></html>
            `
          },
          {
            url: 'https://example.com/b',
            status: 200,
            title: 'Product A Details',
            html: `
              <html><body>
                <h1>Product A</h1>
                <h2>Specs</h2>
                <p>${'spec '.repeat(30)}</p>
              </body></html>
            `
          }
        ];
      }
    };

    const ctx: PluginContext = { flags: { heading: true } };

    if (HeadingHealthPlugin.hooks?.onMetrics) {
      await HeadingHealthPlugin.hooks.onMetrics(ctx, graph);
    }

    expect(ctx.metadata?.headingHealth).toBeDefined();

    const pageA = ctx.metadata?.headingHealth['https://example.com/a'];
    expect(pageA).toBeDefined();
    expect(Array.isArray(pageA.map)).toBe(true);
    expect(Array.isArray(pageA.issues)).toBe(true);
    expect(pageA.hierarchy_skips).toBe(1);
    expect(pageA.reverse_jumps).toBe(0);
    expect(pageA.thin_sections).toBeGreaterThan(0);
    expect(pageA.score).toBeLessThan(100);

    const summary = ctx.metadata?.headingHealthSummary;
    expect(summary).toBeDefined();
    expect(summary.evaluatedPages).toBe(2);
    expect(summary.totalMissing).toBe(0);
    expect(summary.totalSkips).toBeGreaterThan(0);
  });

  it('attaches rich analysis payload on report output', async () => {
    const ctx: PluginContext = {
      flags: { heading: true },
      metadata: {
        headingHealthSummary: { avgScore: 50 },
        headingHealth: {
          'https://example.com/no-h1': {
            issues: ['Missing H1'], map: [{ level: 2, text: 'Section', index: 0 }],
            hierarchy_skips: 0
          }
        }
      }
    };

    const result: any = {
      pages: [
        {
          url: 'https://example.com/no-h1',
          title: 'No Heading Page'
        }
      ]
    };

    if (HeadingHealthPlugin.hooks?.onReport) {
      await HeadingHealthPlugin.hooks.onReport(ctx, result);
    }

    expect(result.plugins.headingHealth).toBeDefined();
    expect(result.plugins.headingHealth.avgScore).toBe(50);

    expect(result.pages[0].plugins.headingHealth).toBeDefined();
    expect(result.pages[0].plugins.headingHealth.issues).toContain('Missing H1');
  });
});
