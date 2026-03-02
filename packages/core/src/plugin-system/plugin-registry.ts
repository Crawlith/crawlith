import { Command } from 'commander';
import { CrawlithPlugin, PluginContext } from './plugin-types.js';

export class PluginRegistry {
    private plugins: CrawlithPlugin[] = [];

    constructor(plugins: CrawlithPlugin[] = []) {
        this.plugins = plugins;
    }

    registerPlugins(program: Command) {
        for (const plugin of this.plugins) {
            if (typeof plugin.register === 'function') {
                plugin.register(program);
            }
        }
    }

    async runHook(hookName: string, context: PluginContext, payload?: any) {
        for (const plugin of this.plugins) {
            const hooks = plugin.hooks as any;
            if (hooks && typeof hooks[hookName] === 'function') {
                try {
                    if (payload !== undefined) {
                        await hooks[hookName](context, payload);
                    } else {
                        await hooks[hookName](context);
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
                try {
                    const result = hooks[hookName](context, ...args);
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
