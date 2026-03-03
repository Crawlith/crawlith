export class PluginRegistry {
    private registeredPlugins: Set<string> = new Set();
    private registeredTables: Map<string, string> = new Map(); // tableName -> pluginName

    registerPlugin(pluginName: string) {
        this.registeredPlugins.add(pluginName);
    }

    isPluginRegistered(pluginName: string): boolean {
        return this.registeredPlugins.has(pluginName);
    }

    registerTable(tableName: string, pluginName: string) {
        this.registeredTables.set(tableName, pluginName);
    }

    getPluginForTable(tableName: string): string | undefined {
        return this.registeredTables.get(tableName);
    }

    isTableRegistered(tableName: string): boolean {
        return this.registeredTables.has(tableName);
    }
}
