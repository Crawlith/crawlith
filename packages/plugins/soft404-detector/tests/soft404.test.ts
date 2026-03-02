import { describe, it, expect } from 'vitest';
import { Soft404DetectorPlugin } from '../index.js';
import { Graph } from '@crawlith/core';

describe('Soft 404 Detection Plugin', () => {
    const baseUrl = 'https://example.com';

    const runPlugin = async (html: string, outLinks: number = 0) => {
        const graph = new Graph();
        graph.addNode(baseUrl, 0, 200);
        const node = graph.nodes.get(baseUrl)!;
        node.html = html;
        node.outLinks = outLinks;

        await Soft404DetectorPlugin.hooks!.onMetrics!({ flags: { detectSoft404: true } } as any, graph);
        return node as any;
    };

    it('should detect soft 404 by title pattern', async () => {
        const html = '<html><head><title>Page Not Found</title></head><body>Welcome to the site</body></html>';
        const result = await runPlugin(html, 1);
        expect(result.soft404.score).toBeGreaterThan(0.3);
        expect(result.soft404.reason).toContain('title_contains_not found');
    });

    it('should detect soft 404 by H1 pattern', async () => {
        const html = '<html><body><h1>404 Error</h1></body></html>';
        const result = await runPlugin(html, 1);
        expect(result.soft404.score).toBeGreaterThan(0.2);
        expect(result.soft404.reason).toContain('h1_contains_404');
    });

    it('should detect soft 404 by very low word count', async () => {
        const html = '<html><body>Short text</body></html>';
        const result = await runPlugin(html, 1);
        expect(result.soft404.score).toBeGreaterThan(0.2);
        expect(result.soft404.reason).toContain('very_low_word_count');
    });

    it('should detect soft 404 by lack of outbound links', async () => {
        const html = '<html><body>A page with some text but no links.</body></html>';
        const result = await runPlugin(html, 0);
        expect(result.soft404.reason).toContain('no_outbound_links');
    });

    it('should combine multiple signals for high score', async () => {
        const html = '<html><head><title>Error</title></head><body><h1>Not Found</h1><p>The requested page was not found.</p></body></html>';
        const result = await runPlugin(html, 1);
        // title (0.4) + h1 (0.3) + low word count (0.3) = 1.0 (capped)
        expect(result.soft404.score).toBe(1.0);
    });

    it('should not do anything if flag is false', async () => {
        const graph = new Graph();
        graph.addNode(baseUrl, 0, 200);
        const node = graph.nodes.get(baseUrl)!;
        node.html = '<html><head><title>Page Not Found</title></head><body>Welcome to the site</body></html>';

        await Soft404DetectorPlugin.hooks!.onMetrics!({ flags: { detectSoft404: false } } as any, graph);

        expect((node as any).soft404).toBeUndefined();
    });
});
