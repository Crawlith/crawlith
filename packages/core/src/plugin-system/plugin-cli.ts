import { Command } from 'commander';
import { setEncryptedConfigKey } from '../utils/secureConfig.js';

/**
 * Standard utility for plugins to register their configuration commands.
 * This ensures a consistent 'config <plugin> set' CLI pattern across the ecosystem.
 * 
 * @param cli - The main Commander instance (must have name 'crawlith').
 * @param pluginName - The unique name of the plugin (e.g., 'pagespeed').
 * @param credentialLabel - Human-readable label for the credential (e.g., 'Google API Key').
 */
export function registerPluginConfigCommand(cli: Command, pluginName: string, credentialLabel: string): void {
    // Only register subcommands if we are in the root 'crawlith' CLI context
    if (cli.name() !== 'crawlith') return;

    // Find or create 'config' command
    let configCmd = cli.commands.find(c => c.name() === 'config');
    if (!configCmd) {
        configCmd = new Command('config').description('Manage Crawlith plugin configuration');
        cli.addCommand(configCmd);
    }

    // Define plugin-specific subcommand
    const pluginConfigCmd = new Command(pluginName).description(`Manage ${pluginName} configuration`);

    pluginConfigCmd
        .command('set <value>')
        .description(`Set and encrypt ${credentialLabel}`)
        .action((value: string) => {
            setEncryptedConfigKey(pluginName, value);
            console.log(`✅ ${credentialLabel} for ${pluginName} saved and encrypted.`);
        });

    configCmd.addCommand(pluginConfigCmd);
}
