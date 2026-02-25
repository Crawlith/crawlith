import { extractLinks } from '../src/crawler/extract.js';
import { test, expect, describe, vi, afterEach } from 'vitest';
import * as cheerio from 'cheerio';

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

    test('should handle cheerio.load errors gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const error = new Error('Cheerio error');

        vi.mocked(cheerio.load).mockImplementationOnce(() => {
            throw error;
        });

        const links = extractLinks('<html></html>', 'https://example.com');

        expect(links).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error extracting links from https://example.com'),
            error
        );
    });

    test('should ignore non-http protocols', () => {
        const html = `
      <html>
        <body>
          <a href="mailto:user@example.com">Email</a>
          <a href="tel:+1234567890">Phone</a>
          <a href="ftp://example.com/file">FTP</a>
          <a href="javascript:alert(1)">JS</a>
          <a href="https://valid.com">Valid</a>
        </body>
      </html>
    `;
        const links = extractLinks(html, 'https://example.com');
        expect(links).toHaveLength(1);
        expect(links).toContain('https://valid.com/');
        expect(links).not.toContain('mailto:user@example.com');
        expect(links).not.toContain('tel:+1234567890');
        expect(links).not.toContain('ftp://example.com/file');
        expect(links).not.toContain('javascript:alert(1)');
    });

    test('should handle invalid URLs gracefully', () => {
        const html = `
      <html>
        <body>
          <a href="http://[">Invalid IPv6</a>
          <a href="https://valid.com">Valid</a>
        </body>
      </html>
    `;
        const links = extractLinks(html, 'https://example.com');
        expect(links).toHaveLength(1);
        expect(links).toContain('https://valid.com/');
    });

    test('should resolve relative paths correctly', () => {
        const html = `
      <html>
        <body>
          <a href="./foo">Current Dir</a>
          <a href="../bar">Parent Dir</a>
          <a href="/root">Root</a>
        </body>
      </html>
    `;
        const links = extractLinks(html, 'https://example.com/a/b/');
        expect(links).toContain('https://example.com/a/b/foo');
        expect(links).toContain('https://example.com/a/bar');
        expect(links).toContain('https://example.com/root');
    });

    test('should ignore a tags without href', () => {
        const html = `
      <html>
        <body>
          <a>No Href</a>
          <a href="">Empty Href</a>
        </body>
      </html>
    `;
        const links = extractLinks(html, 'https://example.com');
        expect(links).toHaveLength(0);
    });
});
