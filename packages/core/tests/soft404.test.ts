import { describe, it, expect } from 'vitest';
import { Parser } from '../src/crawler/parser.js';

describe('Soft 404 Detection', () => {
    const parser = new Parser();
    const baseUrl = 'https://example.com';

    it('should detect soft 404 by title pattern', () => {
        const html = '<html><head><title>Page Not Found</title></head><body>Welcome to the site</body></html>';
        const result = parser.parse(html, baseUrl, 200);
        expect(result.soft404Score).toBeGreaterThan(0.3);
        expect(result.soft404Signals).toContain('title_pattern_not_found');
    });

    it('should detect soft 404 by H1 pattern', () => {
        const html = '<html><body><h1>404 Error</h1></body></html>';
        const result = parser.parse(html, baseUrl, 200);
        expect(result.soft404Score).toBeGreaterThan(0.2);
        expect(result.soft404Signals).toContain('h1_pattern_404');
    });

    it('should detect soft 404 by very low word count', () => {
        const html = '<html><body>Short text</body></html>';
        const result = parser.parse(html, baseUrl, 200);
        expect(result.soft404Score).toBeGreaterThan(0.2);
        expect(result.soft404Signals).toContain('very_low_word_count');
    });

    it('should detect soft 404 by lack of outbound links', () => {
        const html = '<html><body>A page with some text but no links.</body></html>';
        const result = parser.parse(html, baseUrl, 200);
        expect(result.soft404Signals).toContain('no_outbound_links');
    });

    it('should combine multiple signals for high score', () => {
        const html = '<html><head><title>Error</title></head><body><h1>Not Found</h1><p>The requested page was not found.</p></body></html>';
        const result = parser.parse(html, baseUrl, 200);
        // title (0.4) + h1 (0.3) + body phrase (0.2) + low word count (0.3) = 1.2 -> capped at 1.0
        expect(result.soft404Score).toBe(1.0);
    });
});
