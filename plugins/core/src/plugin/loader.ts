import path from 'node:path';
import type { CrawlPlugin } from './types.js';

export interface PluginLoaderOptions {
  paths?: string[];
  packages?: string[];
  trustedRoot?: string;
}

function isFunctionOrUndefined(v: unknown): boolean {
  return typeof v === 'undefined' || typeof v === 'function';
}

function validatePluginShape(plugin: CrawlPlugin): CrawlPlugin {
  if (!plugin || typeof plugin !== 'object' || typeof plugin.name !== 'string' || !plugin.name.trim()) {
    throw new Error('Invalid plugin module: missing `name`');
  }

  const hookNames: (keyof CrawlPlugin)[] = [
    'onInit',
    'onBeforeCrawl',
    'onPageParsed',
    'onGraphBuilt',
    'onMetricsPhase',
    'onAfterCrawl',
    'extendSchema'
  ];

  for (const hookName of hookNames) {
    if (!isFunctionOrUndefined((plugin as any)[hookName])) {
      throw new Error(`Invalid plugin module: hook ${String(hookName)} must be a function`);
    }
  }

  return plugin;
}

function normalizeLoadedPlugin(candidate: unknown): CrawlPlugin {
  const module = candidate as any;
  const plugin = module?.default ?? module?.plugin ?? module;
  return validatePluginShape(plugin as CrawlPlugin);
}

export class PluginLoader {
  async load(options: PluginLoaderOptions): Promise<CrawlPlugin[]> {
    const loaded: CrawlPlugin[] = [];

    for (const modulePath of options.paths ?? []) {
      if (options.trustedRoot) {
        const resolved = path.resolve(modulePath);
        const trusted = path.resolve(options.trustedRoot);
        if (!resolved.startsWith(trusted + path.sep) && resolved !== trusted) {
          throw new Error(`Plugin path outside trusted root: ${modulePath}`);
        }
      }
      const imported = await import(modulePath);
      loaded.push(normalizeLoadedPlugin(imported));
    }

    for (const pkg of options.packages ?? []) {
      if (!pkg.startsWith('crawlith-plugin-')) {
        throw new Error(`Invalid plugin package name: ${pkg}`);
      }
      const imported = await import(pkg);
      loaded.push(normalizeLoadedPlugin(imported));
    }

    return loaded;
  }
}
