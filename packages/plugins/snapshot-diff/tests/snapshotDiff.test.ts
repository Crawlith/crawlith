import { describe, it, expect, vi } from 'vitest';
import { SnapshotDiffPlugin } from '../index.js';

vi.mock('@crawlith/core', () => {
    return {
        compareGraphs: vi.fn(),
        Graph: {
            fromJSON: vi.fn()
        },
        getDb: vi.fn(),
        SiteRepository: class {
            getSite = vi.fn().mockReturnValue({ id: 1 });
        },
        SnapshotRepository: class {
            getLatestSnapshot = vi.fn().mockReturnValue({ id: 5 });
        },
        loadGraphFromSnapshot: vi.fn().mockReturnValue('mocked-graph')
    };
});

describe('SnapshotDiffPlugin', () => {
    it('should resolve previous graph during onCrawlStart when --incremental is passed', async () => {
        const ctx = {
            flags: { incremental: true, url: 'https://example.com' },
            metadata: {}
        };

        await SnapshotDiffPlugin.hooks!.onCrawlStart!(ctx as any);

        expect(ctx.metadata).toHaveProperty('previousGraph', 'mocked-graph');
    });

    it('should ignore resolving previous graph if --incremental is not passed', async () => {
        const ctx = {
            flags: { incremental: false, url: 'https://example.com' },
            metadata: {}
        };

        await SnapshotDiffPlugin.hooks!.onCrawlStart!(ctx as any);

        expect(ctx.metadata).not.toHaveProperty('previousGraph');
    });
});
