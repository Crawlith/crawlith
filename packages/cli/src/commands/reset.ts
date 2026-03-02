import { Command } from 'commander';
import chalk from 'chalk';
import {
    resetCrawlith,
    PluginRegistry
} from '@crawlith/core';

export const getResetCommand = (registry: PluginRegistry) => {
    const reset = new Command('reset')
        .description('Completely reset Crawlith state (DB, reports, and locks).');
    // Let plugins register their flags on this command
    registry.registerPlugins(reset);

    reset.action(async () => {
        try {
            console.log(chalk.yellow('🔄 Resetting Crawlith state...'));

            await resetCrawlith({
                reportsDir: './crawlith-reports'
            });

            console.log(chalk.bold.green('✅ Reset complete. Factory settings restored.'));
        } catch (error) {
            console.error(chalk.red('\n❌ Reset failed:'), (error as Error).message);
            process.exit(1);
        }
    });

    return reset;
};
