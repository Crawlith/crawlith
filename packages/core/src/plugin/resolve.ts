import type { CrawlPlugin } from './types.js';

export function resolvePlugins(allPlugins: CrawlPlugin[], command: string, flags: Record<string, boolean>): CrawlPlugin[] {
  const resolved = allPlugins.filter((plugin) => {
    const cli = plugin.cli;
    if (!cli) return true;
    if (cli.defaultFor?.includes(command)) return true;
    if (cli.optionalFor?.includes(command) && cli.flag && flags[cli.flag]) return true;
    return false;
  });
  // console.log(`[resolvePlugins] command=${command} resolved=${resolved.map(p => p.name).join(',')}`);
  return resolved;
}
