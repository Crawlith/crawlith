import { Command } from 'commander';
import { auditUrl } from '@crawlith/core';
import { renderAuditOutput } from './auditFormatter.js';
import chalk from 'chalk';
import { PluginRegistry } from '@crawlith/core';

export const getProbeCommand = (registry: PluginRegistry) => {
  const probe = new Command('probe')
    .description('Inspect a domain’s transport layer, SSL/TLS, and HTTP configuration.')
    .argument('[url]', 'URL to audit')
    .option('--timeout <ms>', 'request timeout', '10000');

  // Let plugins register their flags on this command
  registry.registerPlugins(probe);

  probe.action(async (url: string, options: any) => {
    if (!url) {
      console.error(chalk.red('\n❌ Error: URL argument is required for audit\n'));
      probe.outputHelp();
      process.exit(0);
    }
    try {
      const result = await auditUrl(url, {
        timeout: parseInt(options.timeout, 10),
        verbose: options.verbose,
        debug: options.debug
      });

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderAuditOutput(result, options.verbose, options.debug));
      }
    } catch (error: any) {
      console.error('Audit failed:', error.message);
      process.exit(1);
    }
  });

  return probe;
};
