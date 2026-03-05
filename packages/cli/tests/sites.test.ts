import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSitesCommand } from '../src/commands/sites.js';
import chalk from '../src/utils/chalk.js';

// Use doMock to avoid hoisting if that was causing issues, or standard vi.mock
vi.mock('@crawlith/core', () => {
  const mockGetAllSites = vi.fn();
  const mockGetSnapshotCount = vi.fn();
  const mockGetLatestSnapshot = vi.fn();
  const mockGetDb = vi.fn();

  return {
    getDb: mockGetDb,
    SiteRepository: class {
      getAllSites = mockGetAllSites;
    },
    SnapshotRepository: class {
      getSnapshotCount = mockGetSnapshotCount;
      getLatestSnapshot = mockGetLatestSnapshot;
    },
    // Expose mocks so tests can control them
    __mocks: {
      mockGetAllSites,
      mockGetSnapshotCount,
      mockGetLatestSnapshot,
      mockGetDb
    }
  };
});

import * as core from '@crawlith/core';

describe('sites command', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  const mockRegistry = { registerPlugins: vi.fn() } as any;
  const sites = getSitesCommand(mockRegistry);

  // Access the mocks
  const { mockGetAllSites, mockGetSnapshotCount, mockGetLatestSnapshot } = (core as any).__mocks;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit called with ${code}`);
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should list sites with correct formatting', async () => {
    // Setup mock data
    mockGetAllSites.mockReturnValue([
      { id: 1, domain: 'example.com' },
      { id: 2, domain: 'test.com' }
    ]);

    mockGetSnapshotCount.mockImplementation((id: number) => {
      if (id === 1) return 5;
      if (id === 2) return 2;
      return 0;
    });

    mockGetLatestSnapshot.mockImplementation((id: number) => {
      if (id === 1) {
        return {
          created_at: '2026-02-25T10:00:00.000Z',
          node_count: 1243,
          health_score: 82
        };
      }
      if (id === 2) {
        return {
          created_at: '2026-02-24T12:00:00.000Z',
          node_count: 312,
          health_score: 74
        };
      }
      return undefined;
    });

    // Run the command
    await sites.parseAsync(['node', 'test']);

    // Verify output structure
    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.bold('example.com'));
    expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('Snapshots:')} 5`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('Last Crawl:')} 2026-02-25`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('Pages:')} 1,243`);

    // Check for colorized health score
    const calls = consoleLogSpy.mock.calls.map((c: any) => c[0]);
    const healthCallExample = calls.find((c: string) => c.includes('Health:') && c.includes('82'));
    expect(healthCallExample).toBeDefined();

    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.bold('test.com'));
    expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('Snapshots:')} 2`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('Last Crawl:')} 2026-02-24`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('Pages:')} 312`);
    const healthCallTest = calls.find((c: string) => c.includes('Health:') && c.includes('74'));
    expect(healthCallTest).toBeDefined();
  });

  it('should handle no sites found', async () => {
    mockGetAllSites.mockReturnValue([]);

    await sites.parseAsync(['node', 'test']);

    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('No sites found. Run a crawl first to add sites.'));
  });

  it('should output JSON when requested', async () => {
    mockGetAllSites.mockReturnValue([
      { id: 1, domain: 'json.com' }
    ]);
    mockGetSnapshotCount.mockReturnValue(1);
    mockGetLatestSnapshot.mockReturnValue({
      created_at: '2025-01-01T00:00:00.000Z',
      node_count: 100,
      health_score: 90
    });

    await sites.parseAsync(['node', 'test', '--format', 'json']);

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify([{
      domain: 'json.com',
      snapshots: 1,
      lastCrawl: '2025-01-01T00:00:00.000Z',
      pages: 100,
      health: 90
    }], null, 2));
  });
});
