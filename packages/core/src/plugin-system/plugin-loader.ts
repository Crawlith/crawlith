import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CrawlithPlugin } from './plugin-types.js';

export interface PluginLoaderLogger {
    debug(msg: string): void;
    info?(msg: string): void;
    warn?(msg: string): void;
    error?(msg: string): void;
}

export class PluginLoader {
    private plugins: Map<string, CrawlithPlugin> = new Map();
    private logger?: PluginLoaderLogger;

    constructor(logger?: PluginLoaderLogger) {
        this.logger = logger;
    }

    async discover(rootPath: string): Promise<CrawlithPlugin[]> {
        // 1. Discover Internal Plugins
        const internalPath = path.resolve(rootPath, 'packages/plugins');
        if (fs.existsSync(internalPath)) {
            this.logger?.debug(`[plugin] Scanning internal directory: ${internalPath}`);
            await this.loadFromDir(internalPath, 'internal');
        }

        // 2. Discover External Plugins
        const nodeModulesPath = path.resolve(rootPath, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
            this.logger?.debug(`[plugin] Scanning node_modules: ${nodeModulesPath}`);
            await this.loadFromNodeModules(nodeModulesPath);
        }

        return Array.from(this.plugins.values());
    }

    private async loadFromDir(dirPath: string, type: 'internal' | 'external') {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const fullPath = path.join(dirPath, entry.name);
                await this.tryLoadPlugin(fullPath, type);
            }
        }
    }

    private async loadFromNodeModules(nodeModulesPath: string) {
        if (!fs.existsSync(nodeModulesPath)) return;
        const entries = fs.readdirSync(nodeModulesPath, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            if (entry.name.startsWith('@')) {
                // Scoped packages
                const scopePath = path.join(nodeModulesPath, entry.name);
                const scopedEntries = fs.readdirSync(scopePath, { withFileTypes: true });
                for (const scopedEntry of scopedEntries) {
                    if (scopedEntry.isDirectory()) {
                        await this.tryLoadPlugin(path.join(scopePath, scopedEntry.name), 'external');
                    }
                }
            } else {
                await this.tryLoadPlugin(path.join(nodeModulesPath, entry.name), 'external');
            }
        }
    }

    private async tryLoadPlugin(pluginPath: string, type: 'internal' | 'external') {
        const pkgPath = path.join(pluginPath, 'package.json');
        if (!fs.existsSync(pkgPath)) return;

        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

            const isCrawlithPlugin =
                pkg.name?.startsWith('@crawlith/plugin-') ||
                pkg.name?.startsWith('crawlith-plugin-') ||
                pkg.crawlith?.type === 'plugin' ||
                type === 'internal';

            if (!isCrawlithPlugin) return;

            let entryPoint = pkg.exports ?? pkg.main ?? 'index.js';
            if (typeof entryPoint === 'object' && entryPoint !== null) {
                entryPoint = (entryPoint as any)['.'] ?? (entryPoint as any).import ?? (entryPoint as any).default ?? 'index.js';
            }
            if (typeof entryPoint !== 'string') {
                entryPoint = 'index.js';
            }

            let fullEntryPoint = path.join(pluginPath, entryPoint);

            // If we're loading a .ts file as the intended entry point, but a .js one exists in dist, 
            // prefer the .js one to avoid requiring a TS loader at runtime.
            if (fullEntryPoint.endsWith('.ts')) {
                const distJsPath = path.join(pluginPath, 'dist', 'index.js');
                if (fs.existsSync(distJsPath)) {
                    fullEntryPoint = distJsPath;
                }
            }

            if (!fs.existsSync(fullEntryPoint) && fs.existsSync(path.join(pluginPath, 'index.ts'))) {
                fullEntryPoint = path.join(pluginPath, 'index.ts');
            }

            if (!fs.existsSync(fullEntryPoint)) {
                this.logger?.debug(`[plugin] Skipped: ${pkg.name} (entry point not found: ${fullEntryPoint})`);
                return;
            }

            const imported = await import(pathToFileURL(fullEntryPoint).href);
            const plugin = imported.default || imported;
            if (this.validatePlugin(plugin, pkg)) {
                if (this.plugins.has(plugin.name)) {
                    throw new Error(`Duplicate plugin name: ${plugin.name}`);
                }
                this.plugins.set(plugin.name, plugin);
                this.logger?.debug(`[plugin] Loaded: ${plugin.name} v${plugin.version} (${type})`);
            }
        } catch (err) {
            this.logger?.debug(`[plugin] Failed to load plugin at ${pluginPath}: ${(err as Error).message}`);
        }
    }

    private validatePlugin(plugin: any, pkg: any): plugin is CrawlithPlugin {
        if (!plugin || typeof plugin !== 'object') {
            this.logger?.debug(`[plugin] Skipped: ${pkg.name} (invalid export)`);
            return false;
        }
        if (!plugin.name) {
            this.logger?.debug(`[plugin] Skipped: ${pkg.name} (missing name)`);
            return false;
        }
        if (!plugin.version) {
            plugin.version = pkg.version || '0.0.0';
        }
        if (!plugin.description) {
            plugin.description = pkg.description || '';
        }
        return true;
    }
}
