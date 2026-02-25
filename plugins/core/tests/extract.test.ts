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

    test('should return empty array when cheerio.load throws an error', () => {
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

    test('should handle duplicate links and ignore hash fragments', () => {
        const html = `
      <html>
        <body>
          <a href="/foo">Foo 1</a>
          <a href="/foo">Foo 2</a>
          <a href="/foo#bar">Foo 3</a>
        </body>
      </html>
    `;
        const links = extractLinks(html, 'https://example.com');
        expect(links).toHaveLength(1);
        expect(links).toContain('https://example.com/foo');
    });

    test('should ignore non-http protocols', () => {
        const html = `
      <html>
        <body>
          <a href="mailto:test@example.com">Email</a>
          <a href="tel:1234567890">Phone</a>
          <a href="javascript:void(0)">JS</a>
          <a href="ftp://example.com/file">FTP</a>
          <a href="http://example.com">HTTP</a>
          <a href="https://example.com">HTTPS</a>
        </body>
      </html>
    `;
        const links = extractLinks(html, 'https://example.com');
        expect(links).toHaveLength(2);
        expect(links).toContain('http://example.com/');
        expect(links).toContain('https://example.com/');
    });

    test('should handle invalid href attributes gracefully', () => {
        const html = `
      <html>
        <body>
          <a href="http://[invalid-url]">Invalid 1</a>
        </body>
      </html>
    `;
        const links = extractLinks(html, 'https://example.com');
        expect(links).toHaveLength(0);
    });
});
