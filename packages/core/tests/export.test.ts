import { describe, expect, test, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runCrawlExports } from '../src/report/export.js';
import type { BaseReport } from '../src/plugin/types.js';

vi.mock('node:fs/promises');
vi.mock('chalk', () => ({
    default: {
        green: vi.fn(x => x),
        gray: vi.fn(x => x),
        blueBright: vi.fn(x => x),
        cyan: vi.fn(x => x)
    }
}));

describe('runCrawlExports', () => {
    test('renders plugin sections automatically in markdown', async () => {
        const report: BaseReport = {
            snapshotId: '123',
            pages: 10,
            summary: { healthScore: 90, status: 'good' },
            issues: {},
            metrics: {},
            plugins: {
                'heading-health': { missingH1: 12 },
                'other-plugin': { test: true }
            }
        };

        const appendFileSpy = vi.spyOn(fs, 'appendFile').mockResolvedValue(undefined);
        const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
        const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);

        await runCrawlExports(
            ['markdown'],
            './output',
            'https://example.com',
            { nodes: [], edges: [] },
            {
                averageDepth: 0,
                maxDepthFound: 0,
                crawlEfficiencyScore: 100
            },
            { limitReached: false, sessionStats: {} },
            report
        );

        expect(appendFileSpy).toHaveBeenCalledTimes(2);

        // First plugin
        expect(appendFileSpy).toHaveBeenNthCalledWith(
            1,
            path.join('./output', 'summary.md'),
            expect.stringContaining('## Plugin: heading-health')
        );
        expect(appendFileSpy).toHaveBeenNthCalledWith(
            1,
            path.join('./output', 'summary.md'),
            expect.stringContaining('"missingH1": 12')
        );

        // Second plugin
        expect(appendFileSpy).toHaveBeenNthCalledWith(
            2,
            path.join('./output', 'summary.md'),
            expect.stringContaining('## Plugin: other-plugin')
        );

        appendFileSpy.mockRestore();
        writeFileSpy.mockRestore();
        mkdirSpy.mockRestore();
    });
});
