import { describe, expect, it } from 'vitest';
import HeadingHealthPlugin from './index.js';

describe('heading-health plugin', () => {
  it('computes detailed per-page heading map data and summary metrics', async () => {
    const upserts: Array<{ url: string; data: Record<string, unknown> }> = [];
    let savedSummary: Record<string, unknown> | null = null;

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

    await HeadingHealthPlugin.hooks?.onMetrics?.({
      graph,
      cli: {
        info() {}, warn() {}, error() {}, verbose() {}, debug() {}, section() {}, table() {}
      },
      store: {
        upsertPageData(url: string, data: Record<string, unknown>) {
          upserts.push({ url, data });
        },
        saveSummary(data: unknown) {
          savedSummary = data as Record<string, unknown>;
        },
        loadSummary() {
          return null;
        },
        getPageData() {
          return null;
        }
      }
    } as any);

    expect(upserts).toHaveLength(2);
    const first = upserts[0].data;
    expect(typeof first.map).toBe('string');
    expect(typeof first.issues).toBe('string');
    expect(first.hierarchy_skips).toBe(1);
    expect(first.reverse_jumps).toBe(0);
    expect(first.thin_sections).toBeGreaterThan(0);
    expect(first.score).toBeLessThan(100);

    const summary = savedSummary as Record<string, number>;
    expect(summary).toBeTruthy();
    expect(summary.evaluatedPages).toBe(2);
    expect(summary.totalMissing).toBe(0);
    expect(summary.totalSkips).toBeGreaterThan(0);
  });

  it('attaches rich analysis payload on analyze output', async () => {
    const result: any = {
      pages: [
        {
          url: 'https://example.com/no-h1',
          title: 'No Heading Page',
          html: '<html><body><h2>Section</h2><p>Text</p></body></html>'
        }
      ]
    };

    await HeadingHealthPlugin.onAnalyzeDone?.(result, {});

    expect(result.pages[0].plugins['heading-health']).toBeDefined();
    expect(result.pages[0].plugins['heading-health'].map).toHaveLength(1);
    expect(result.pages[0].plugins['heading-health'].metrics.hierarchySkips).toBe(0);
    expect(result.pages[0].plugins['heading-health'].issues).toContain('Missing H1');
  });
});
