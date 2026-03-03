import { describe, it, expect, vi, beforeEach } from 'vitest';

const compareGraphs = vi.fn().mockReturnValue({
  addedUrls: ['https://example.com/new'],
  removedUrls: [],
  changedStatus: [],
  metricDeltas: { totalPages: 1 }
});

const loadGraphFromSnapshot = vi.fn((snapshotId: number) => ({ snapshotId }));

vi.mock('@crawlith/core', () => {
  return {
    compareGraphs,
    loadGraphFromSnapshot,
    getDb: vi.fn(),
    SiteRepository: class {
      getSite = vi.fn().mockReturnValue({ id: 1 });
    },
    SnapshotRepository: class {
      getLatestSnapshot = vi.fn().mockReturnValue({ id: 5 });
    }
  };
});

const { SnapshotDiffPlugin } = await import('../index.js');

describe('SnapshotDiffPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves previous graph during onCrawlStart when --incremental is passed', async () => {
    const ctx = {
      flags: { incremental: true, url: 'https://example.com' },
      metadata: {},
      logger: { info: vi.fn(), warn: vi.fn() }
    };

    await SnapshotDiffPlugin.hooks!.onCrawlStart!(ctx as any);

    expect(ctx.metadata).toHaveProperty('previousGraph', { snapshotId: 5 });
    expect(loadGraphFromSnapshot).toHaveBeenCalledWith(5);
  });

  it('does not resolve previous graph when --incremental is not passed', async () => {
    const ctx = {
      flags: { incremental: false, url: 'https://example.com' },
      metadata: {},
      logger: { info: vi.fn(), warn: vi.fn() }
    };

    await SnapshotDiffPlugin.hooks!.onCrawlStart!(ctx as any);

    expect(ctx.metadata).not.toHaveProperty('previousGraph');
  });

  it('compares two snapshot IDs during onInit and terminates execution', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const ctx = {
      flags: { compare: ['10', '11'] },
      logger: { info: vi.fn(), warn: vi.fn() }
    };

    await SnapshotDiffPlugin.hooks!.onInit!(ctx as any);

    expect(loadGraphFromSnapshot).toHaveBeenCalledWith(10);
    expect(loadGraphFromSnapshot).toHaveBeenCalledWith(11);
    expect(compareGraphs).toHaveBeenCalled();
    expect(ctx).toHaveProperty('terminate', true);
    logSpy.mockRestore();
  });

  it('throws when --compare is not a pair of snapshot IDs', async () => {
    const ctx = {
      flags: { compare: ['10'] },
      logger: { info: vi.fn(), warn: vi.fn() }
    };

    await expect(SnapshotDiffPlugin.hooks!.onInit!(ctx as any)).rejects.toThrow(
      '--compare requires exactly two snapshot IDs'
    );
  });
});
