import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Command, Option } from 'commander';
import { CommandRegistry } from '../src/registry/commandRegistry.js';
import { getCrawlCommand } from '../src/commands/crawl.js';
import { getCleanCommand } from '../src/commands/clean.js';

const getAllSitesMock = vi.fn().mockReturnValue([{ domain: 'example.com' }, { domain: 'docs.example.com' }]);

vi.mock('@crawlith/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@crawlith/core')>();
  return {
    ...actual,
    getDb: vi.fn().mockReturnValue({}),
    SiteRepository: class {
      getAllSites = getAllSitesMock;
      getSite = vi.fn();
      deleteSite = vi.fn();
    },
    SnapshotRepository: class {
      getSnapshot = vi.fn();
      deleteSnapshot = vi.fn();
      getLatestSnapshot = vi.fn();
    }
  };
});

describe('dynamic completion', () => {
  const mockRegistry = {
    registerPlugins: vi.fn((command: Command) => {
      command.addOption(new Option('--plugin-mode <mode>', 'Plugin mode').choices(['safe', 'aggressive']));
    })
  } as any;

  const root = new Command('crawlith');
  root.addCommand(getCrawlCommand(mockRegistry));
  root.addCommand(getCleanCommand(mockRegistry));

  // Simulate registering plugins on the root program directly
  const pluginCommand = new Command('plugin-audit')
    .description('Plugin-provided command')
    .option('--plugin-flag <value>', 'Plugin command flag');
  root.addCommand(pluginCommand);

  const completionRegistry = new CommandRegistry(root, mockRegistry);

  beforeEach(() => {
    getAllSitesMock.mockClear();
  });

  test('completes core command names', () => {
    const result = completionRegistry.getCompletions({ words: ['crawlith', 'c'], cword: 1 });

    expect(result).toContain('crawl');
    expect(result).toContain('clean');
  });

  test('completes plugin command names', () => {
    const result = completionRegistry.getCompletions({ words: ['crawlith', 'plugin'], cword: 1 });

    expect(result).toContain('plugin-audit');
  });

  test('completes command and plugin flags', () => {
    const result = completionRegistry.getCompletions({ words: ['crawlith', 'crawl', '--'], cword: 2 });

    expect(result).toContain('--limit');
    expect(result).toContain('--plugin-mode');
  });

  test('completes enum values for plugin-defined options', () => {
    const result = completionRegistry.getCompletions({ words: ['crawlith', 'crawl', '--plugin-mode', 'a'], cword: 3 });

    expect(result).toEqual(['aggressive']);
  });

  test('completes database-backed site values for clean command positional argument', () => {
    const result = completionRegistry.getCompletions({ words: ['crawlith', 'clean', 'd'], cword: 2 });

    expect(getAllSitesMock).toHaveBeenCalled();
    expect(result).toContain('docs.example.com');
  });

  test('does not suggest non-repeatable options twice', () => {
    const result = completionRegistry.getCompletions({ words: ['crawlith', 'crawl', '--limit', '10', '--'], cword: 4 });

    expect(result).not.toContain('--limit');
  });
});
