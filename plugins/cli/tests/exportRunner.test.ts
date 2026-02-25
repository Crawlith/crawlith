import { describe, expect, test, vi, afterEach } from 'vitest';
import { runSitegraphExports } from '../src/utils/exportRunner.js';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');
vi.mock('node:path', async () => {
    const actual = await vi.importActual<any>('node:path');
    return {
        ...actual,
        join: (...args: string[]) => args.join('/'),
        resolve: (arg: string) => arg
    };
});

describe('runSitegraphExports', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test('generates visualization HTML correctly', async () => {
        const mockGraphData = {
            nodes: [
                { url: 'https://example.com/', html: '<h1>test</h1>', other: 'data' }
            ],
            edges: []
        };
        const mockMetrics = {
            totalPages: 1
        };

        await runSitegraphExports(
            ['visualize'],
            '/output',
            'https://example.com',
            mockGraphData,
            mockMetrics,
            {}
        );

        expect(fs.mkdir).toHaveBeenCalledWith('/output', { recursive: true });

        // Find the call that writes sitegraph.html
        const writeCall = vi.mocked(fs.writeFile).mock.calls.find(call => call[0] === '/output/sitegraph.html');
        expect(writeCall).toBeDefined();

        const content = writeCall![1] as string;
        expect(content).toContain('window.GRAPH_DATA =');
        expect(content).toContain('window.METRICS_DATA =');

        // Before refactor, it uses pretty print, so we expect formatted JSON
        // After refactor, it will use safeJson (minified)
        // For now, let's just check that the data is present
        expect(content).toContain('https://example.com/');

        // The HTML property should be removed
        expect(content).not.toContain('<h1>test</h1>');
    });
});
