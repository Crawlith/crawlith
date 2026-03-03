import { Command } from 'commander';
import { CrawlithPlugin, PluginContext, CLIWriter } from './plugin-types.js';
import { PluginConfig } from './plugin-config.js';

export class PluginRegistry {
    private plugins: CrawlithPlugin[] = [];

    constructor(plugins: CrawlithPlugin[] = []) {
        this.plugins = plugins;
    }

    public get pluginsList(): CrawlithPlugin[] {
        return this.plugins;
    }

    private registeredCommands = new WeakSet<Command>();

    /**
     * Registers all plugin CLI flags on the given command.
     * Handles both declarative `cli` config and legacy `register(cmd)` callbacks.
     */
    registerPlugins(program: any) {
        if (!(program instanceof Command)) return;

        const traverse = (cmd: Command) => {
            if (this.registeredCommands.has(cmd)) return;
            this.registeredCommands.add(cmd);

            const cmdName = cmd.name() as 'page' | 'crawl';

            for (const plugin of this.plugins) {
                // Declarative cli registration (preferred)
                if (plugin.cli) {
                    const targets = plugin.cli.for ?? ['page', 'crawl'];
                    if (targets.includes(cmdName)) {
                        cmd.option(plugin.cli.flag, plugin.cli.description);
                        for (const opt of plugin.cli.options ?? []) {
                            const dv = opt.defaultValue;
                            if (dv !== undefined && dv !== null) {
                                cmd.option(opt.flag, opt.description, dv as string | boolean | string[]);
                            } else {
                                cmd.option(opt.flag, opt.description);
                            }
                        }
                    }
                }

                // Legacy imperative registration (backwards compat)
                if (typeof plugin.register === 'function') {
                    plugin.register(cmd);
                }
            }

            for (const sub of cmd.commands) {
                traverse(sub);
            }
        };

        traverse(program);
    }

    /**
     * Applies declarative `storage` schemas for all plugins.
     * Called by the core after `getCrawlithDB()` is available, before any hooks run.
     */
    applyStorage(context: PluginContext): void {
        for (const plugin of this.plugins) {
            if (!plugin.storage?.perPage?.columns) continue;
            if (!context.db) continue;

            try {
                const scopedDb = context.db.scope(plugin.name, context.snapshotId, {
                    live: context.live,
                    fetchMode: plugin.storage.fetchMode
                });
                scopedDb.schema.define(plugin.storage.perPage.columns as any);
            } catch (err) {
                context.logger?.error(
                    `[plugin:${plugin.name}] Storage schema failed: ${(err as Error).message}`
                );
            }
        }
    }

    // ─── Scope guards ─────────────────────────────────────────────────────────

    /** Hooks that only make sense during a full site crawl. */
    private static readonly CRAWL_ONLY_HOOKS = new Set([
        'onCrawlStart', 'onPageParsed', 'onGraphBuilt', 'onMetrics', 'onReport', 'shouldEnqueueUrl'
    ]);

    /** Hooks that only make sense during a single-page analysis. */
    private static readonly PAGE_ONLY_HOOKS = new Set([
        'onPage'
    ]);

    // ─── Hook runners ─────────────────────────────────────────────────────────

    async runHook(hookName: string, context: PluginContext, payload?: any) {
        // Enforce scope: silently skip hooks that don't belong to this execution context.
        // Undefined scope (legacy/test) is treated as permissive.
        if (context.scope === 'page' && PluginRegistry.CRAWL_ONLY_HOOKS.has(hookName)) return;
        if (context.scope === 'crawl' && PluginRegistry.PAGE_ONLY_HOOKS.has(hookName)) return;

        for (const plugin of this.plugins) {
            const hooks = plugin.hooks as any;
            if (hooks && typeof hooks[hookName] === 'function') {
                const scopedDb = context.db?.scope(plugin.name, context.snapshotId || payload?.snapshotId, {
                    live: context.live,
                    fetchMode: plugin.storage?.fetchMode
                });
                const scopedConfig = new PluginConfig(plugin.name);

                // Resolve targetUrl from payload if available (standard result object)
                const targetUrl = context.targetUrl || payload?.pages?.[0]?.url;

                // Build a CLIWriter that prefixes plugin name — satisfies both cli and logger
                const cliWriter: CLIWriter = {
                    info: (m) => context.logger?.info(m),
                    warn: (m) => context.logger?.warn(m),
                    error: (m) => context.logger?.error(m),
                    debug: (m) => context.logger?.debug(m),
                };

                const scopedContext: PluginContext = {
                    ...context,
                    db: scopedDb,
                    config: scopedConfig,
                    targetUrl,
                    cli: cliWriter,
                    logger: cliWriter,  // keep logger alias in sync
                };

                try {
                    if (payload !== undefined) {
                        await hooks[hookName](scopedContext, payload);
                    } else {
                        await hooks[hookName](scopedContext);
                    }
                } catch (err) {
                    context.logger?.error(
                        `[plugin:${plugin.name}] Hook ${hookName} failed: ${(err as Error).message}`
                    );
                }
            }
        }
    }

    runSyncBailHook(hookName: string, context: PluginContext, ...args: any[]): any {
        for (const plugin of this.plugins) {
            const hooks = plugin.hooks as any;
            if (hooks && typeof hooks[hookName] === 'function') {
                const scopedDb = context.db?.scope(plugin.name, context.snapshotId, {
                    live: context.live,
                    fetchMode: plugin.storage?.fetchMode
                });
                const scopedConfig = new PluginConfig(plugin.name);
                const scopedContext: PluginContext = { ...context, db: scopedDb, config: scopedConfig };

                try {
                    const result = hooks[hookName](scopedContext, ...args);
                    if (result !== undefined) return result;
                } catch (err) {
                    context.logger?.error(
                        `[plugin:${plugin.name}] Sync bail hook ${hookName} failed: ${(err as Error).message}`
                    );
                }
            }
        }
        return undefined;
    }

    getPlugins(): CrawlithPlugin[] {
        return this.plugins;
    }

    addPlugin(plugin: CrawlithPlugin) {
        if (this.plugins.some(p => p.name === plugin.name)) {
            throw new Error(`Duplicate plugin name: ${plugin.name}`);
        }
        this.plugins.push(plugin);
    }
}
