import { Command } from 'commander';
import { CrawlithPlugin, PluginContext } from './plugin-types.js';
import { PluginConfig } from './plugin-config.js';

export class PluginRegistry {
    private plugins: CrawlithPlugin[] = [];

    constructor(plugins: CrawlithPlugin[] = []) {
        this.plugins = plugins;
    }

    private registeredCommands = new WeakSet<Command>();

    registerPlugins(program: any) {
        if (!(program instanceof Command)) return;

        const traverse = (cmd: Command) => {
            if (this.registeredCommands.has(cmd)) return;
            this.registeredCommands.add(cmd);

            for (const plugin of this.plugins) {
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

    async runHook(hookName: string, context: PluginContext, payload?: any) {
        for (const plugin of this.plugins) {
            const hooks = plugin.hooks as any;
            if (hooks && typeof hooks[hookName] === 'function') {
                const scopedDb = context.db?.scope(plugin.name, context.snapshotId || (payload?.snapshotId));
                const scopedConfig = new PluginConfig(plugin.name);

                // Resolve targetUrl from payload if available (standard result object)
                const targetUrl = context.targetUrl || payload?.pages?.[0]?.url;

                const scopedContext = {
                    ...context,
                    db: scopedDb,
                    config: scopedConfig,
                    targetUrl
                };

                try {
                    if (payload !== undefined) {
                        await hooks[hookName](scopedContext, payload);
                    } else {
                        await hooks[hookName](scopedContext);
                    }
                } catch (err) {
                    context.logger?.error(`[plugin:${plugin.name}] Hook ${hookName} failed: ${(err as Error).message}`);
                }
            }
        }
    }

    runSyncBailHook(hookName: string, context: PluginContext, ...args: any[]): any {
        for (const plugin of this.plugins) {
            const hooks = plugin.hooks as any;
            if (hooks && typeof hooks[hookName] === 'function') {
                const scopedDb = context.db?.scope(plugin.name, context.snapshotId);
                const scopedConfig = new PluginConfig(plugin.name);
                const scopedContext = { ...context, db: scopedDb, config: scopedConfig };

                try {
                    const result = hooks[hookName](scopedContext, ...args);
                    if (result !== undefined) return result;
                } catch (err) {
                    context.logger?.error(`[plugin:${plugin.name}] Sync bail hook ${hookName} failed: ${(err as Error).message}`);
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
