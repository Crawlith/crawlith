import { CommandModule } from 'yargs';
import { auditUrl } from '@crawlith/core';
import { renderAuditOutput } from './auditFormatter.js';
import { withOutputOptions } from './shared.js';

export const auditCommand: CommandModule = {
  command: 'audit <url>',
  describe: 'Perform infrastructure, transport, TLS, DNS, and security-header diagnostics',
  builder: (y) => {
    return withOutputOptions(y)
      .positional('url', {
        type: 'string',
        describe: 'URL to audit'
      })
      .option('timeout', {
        type: 'number',
        default: 10000,
        describe: 'request timeout (ms)'
      });
  },
  handler: async (argv: any) => {
    try {
      const verbose = argv['log-level'] === 'verbose';
      const debug = argv['log-level'] === 'debug';
      const json = argv.format === 'json';

      const result = await auditUrl(argv.url, {
        timeout: argv.timeout,
        verbose,
        debug
      });

      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderAuditOutput(result, verbose, debug));
      }
    } catch (error: any) {
      console.error('Audit failed:', error.message);
      process.exit(1);
    }
  }
};
