import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../src/plugin-system/plugin-registry.js';
import { CrawlithPlugin, PluginContext } from '../src/plugin-system/plugin-types.js';
import { Command } from 'commander';

describe('Plugin System', () => {
    it('should register CLI flags from plugins', () => {
        const program = new Command();
        const registerSpy = vi.fn();

        const plugin: CrawlithPlugin = {
            name: 'test-plugin',
            version: '1.0.0',
            register: registerSpy
        };

        const registry = new PluginRegistry([plugin]);
        registry.registerPlugins(program);

        expect(registerSpy).toHaveBeenCalledWith(program);
    });

    it('should prevent duplicate plugin names', () => {
        const plugin: CrawlithPlugin = {
            name: 'test-plugin',
            version: '1.0.0'
        };

        const registry = new PluginRegistry([plugin]);

        expect(() => {
            registry.addPlugin(plugin);
        }).toThrow('Duplicate plugin name: test-plugin');
    });

    it('should execute lifecycle hooks in order', async () => {
        const order: string[] = [];
        const ctx: PluginContext = { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } };

        const pluginA: CrawlithPlugin = {
            name: 'plugin-a',
            version: '1.0.0',
            hooks: {
                onInit: async () => { order.push('a-init'); }
            }
        };

        const pluginB: CrawlithPlugin = {
            name: 'plugin-b',
            version: '1.0.0',
            hooks: {
                onInit: async () => { order.push('b-init'); }
            }
        };

        const registry = new PluginRegistry([pluginA, pluginB]);
        await registry.runHook('onInit', ctx);

        expect(order).toEqual(['a-init', 'b-init']);
    });

    it('should handle hook failures gracefully', async () => {
        const errorSpy = vi.fn();
        const ctx: PluginContext = { logger: { info: vi.fn(), warn: vi.fn(), error: errorSpy, debug: vi.fn() } };

        const plugin: CrawlithPlugin = {
            name: 'fail-plugin',
            version: '1.0.0',
            hooks: {
                onInit: () => { throw new Error('Boom'); }
            }
        };

        const registry = new PluginRegistry([plugin]);
        await registry.runHook('onInit', ctx);

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Hook onInit failed: Boom'));
    });
});
