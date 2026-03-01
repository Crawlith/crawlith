import { describe, expect, test } from 'vitest';
import { allPlugins, resolveCommandPlugins } from '../src/plugins.js';

describe('command-aware plugin activation', () => {
  test('heading-health defaults for crawl', () => {
    const active = resolveCommandPlugins('crawl', {});
    expect(active.some((p) => p.name === 'heading-health')).toBe(true);
  });

  test('heading-health is optional for page', () => {
    expect(resolveCommandPlugins('page', {}).some((p) => p.name === 'heading-health')).toBe(false);
    expect(resolveCommandPlugins('page', { heading: true }).some((p) => p.name === 'heading-health')).toBe(true);
  });

  test('plugin list is non-empty', () => {
    expect(allPlugins.length).toBeGreaterThan(0);
  });
});
