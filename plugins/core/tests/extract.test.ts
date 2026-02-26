import { extractLinks } from '../src/crawler/extract.js';
import { test, expect, describe, vi, afterEach } from 'vitest';
import * as cheerio from 'cheerio';

// Mock cheerio.load to allow us to simulate errors
vi.mock('cheerio', async (importOriginal) => {
    const mod = await importOriginal<any>();
    return {
        ...mod,
        load: vi.fn((...args: any[]) => mod.load(...args))
    };
});

describe('extractLinks', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('should extract links correctly', () => {
        const html = `
      <html>
        <body>
          <a href="/foo">Foo</a>
          <a href="bar">Bar</a>
          <a href="https://other.com/baz">Baz</a>
          <a href="#top">Top</a>
        </body>
      </html>
    `;
        const links = extractLinks(html, 'https://example.com/page/');
        expect(links).toContain('https://example.com/foo');
        expect(links).toContain('https://example.com/page/bar');
        expect(links).toContain('https://other.com/baz');
        expect(links).not.toContain('https://example.com/page/#top');
        expect(links).toContain('https://example.com/page/');
    });

    test('should handle cheerio errors gracefully', () => {
        const error = new Error('Cheerio error');

        // Mock cheerio.load to throw an error
        vi.mocked(cheerio.load).mockImplementationOnce(() => {
            throw error;
        });

        const links = extractLinks('<html></html>', 'https://example.com');

        expect(links).toEqual([]);
        // No console error expected
    });

    test('should handle non-Error exceptions gracefully', () => {
        const error = 'String error'; // Simulate a thrown string

        vi.mocked(cheerio.load).mockImplementationOnce(() => {
            throw error;
        });

        const links = extractLinks('<html></html>', 'https://example.com');

        expect(links).toEqual([]);
        // No console error expected
    });

    test('should ignore invalid URLs that cause URL constructor to throw', () => {
        const html = '<a href="http://[">Invalid</a>';
        const links = extractLinks(html, 'https://example.com');
        expect(links).toEqual([]);
    });

    test('should ignore non-http protocols', () => {
        const html = `
            <a href="mailto:test@example.com">Mail</a>
            <a href="javascript:void(0)">JS</a>
            <a href="ftp://example.com/file">FTP</a>
        `;
        const links = extractLinks(html, 'https://example.com');
        expect(links).toEqual([]);
    });

    test('should ignore links without href', () => {
        const html = '<a>No Href</a>';
        const links = extractLinks(html, 'https://example.com');
        expect(links).toEqual([]);
    });
});
