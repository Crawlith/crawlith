import { Command, registerPluginConfigCommand } from '@crawlith/core';

/**
 * Registers the configuration command for the PageSpeed plugin using the core registry API.
 * This ensures the 'config pagespeed set' command is available in the main CLI.
 * 
 * @param cli - The Commander instance.
 */
export function registerConfigCommand(cli: Command): void {
    registerPluginConfigCommand(cli, 'pagespeed', 'Google PageSpeed Insights API Key');
}
