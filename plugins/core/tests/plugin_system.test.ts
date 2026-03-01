import { describe, expect, test } from 'vitest';
import { PluginLoader, PluginManager, resolvePlugins, type CrawlPlugin } from '../src/index.js';

describe('plugin system', () => {
  test('resolves command-aware plugins', () => {
    const plugins: CrawlPlugin[] = [
      { name: 'a', cli: { defaultFor: ['crawl'] } },
      { name: 'b', cli: { flag: 'heading', optionalFor: ['page'] } },
      { name: 'c' }
    ];

    expect(resolvePlugins(plugins, 'crawl', {})).toHaveLength(2);
    expect(resolvePlugins(plugins, 'page', {}).map(p => p.name)).toEqual(['c']);
    expect(resolvePlugins(plugins, 'page', { heading: true }).map(p => p.name)).toEqual(['b', 'c']);
  });

  test('plugin manager runs hooks sequentially', async () => {
    const calls: string[] = [];
    const manager = new PluginManager([
      { name: 'a', async onInit() { calls.push('a'); } },
      { name: 'b', async onInit() { calls.push('b'); } }
    ]);
    await manager.runHook('onInit', {});
    expect(calls).toEqual(['a', 'b']);
  });

  test('plugin loader validates shape', async () => {
    const loader = new PluginLoader();
    await expect(loader.load({ packages: ['not-crawlith-plugin-x'] })).rejects.toThrow();
  });
});
