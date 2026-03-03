import { getDecryptedConfigKey, setEncryptedConfigKey } from '../utils/secureConfig.js';

export class PluginConfig {
    constructor(private pluginName: string) { }

    /**
     * Get a decrypted config key for the current plugin.
     */
    public get(keyName?: string): string {
        const section = keyName || this.pluginName;

        // Safety check: ensure plugins can only access their own config section
        if (section !== this.pluginName) {
            throw new Error(`Security Violation: Plugin "${this.pluginName}" attempted to access config for "${section}"`);
        }

        return getDecryptedConfigKey(section);
    }

    /**
     * Get a decrypted config key, or throw a user-friendly error if it's missing.
     */
    public require(keyName?: string): string {
        try {
            return this.get(keyName);
        } catch (_error) {
            const section = keyName || this.pluginName;
            throw new Error(`Missing ${section} configuration. Please run: crawlith config ${section} set <value>`, { cause: _error });
        }
    }

    /**
     * Set/Encrypt a config key for the current plugin.
     */
    public set(value: string): void {
        setEncryptedConfigKey(this.pluginName, value);
    }
}
