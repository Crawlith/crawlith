import { describe, expect, it, vi } from 'vitest';
import type { PluginContext } from '@crawlith/core';
import HeadingHealthPlugin from './index.js';

describe('heading-health plugin', () => {
    it('computes per-page heading payload and summary metrics', async () => {
        const rawNodes = [
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

        const graph = { getNodes: () => rawNodes };

        const getOrFetch = vi.fn(async (url, fetchFn) => fetchFn());

        const ctx: PluginContext = {
            flags: { heading: true },
            db: {
                data: { getOrFetch }
            } as any
        };

        await HeadingHealthPlugin.hooks?.onMetrics?.(ctx, graph);

        const pageA = (rawNodes.find((node) => node.url === 'https://example.com/a') as any)?.headingHealth;
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

        expect(getOrFetch).toHaveBeenCalledTimes(2);
    });

    it('attaches summary payload on report output', async () => {
        const ctx: PluginContext = {
            flags: { heading: true },
            metadata: {
                headingHealthSummary: { avgScore: 50, evaluatedPages: 1, poorPages: 1 }
            }
        };

        const result: any = { pages: [] };

        await HeadingHealthPlugin.hooks?.onReport?.(ctx, result);

        expect(result.plugins.headingHealth).toBeDefined();
        expect(result.plugins.headingHealth.avgScore).toBe(50);
    });
});
