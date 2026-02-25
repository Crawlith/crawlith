import { Command } from 'commander';
import { auditUrl } from '@crawlith/core';
import { renderAuditOutput } from './auditFormatter.js';

export const audit = new Command('audit')
  .description('Perform infrastructure, transport, TLS, DNS, and security-header diagnostics')
  .argument('<url>', 'URL to audit')
  .option('--verbose', 'prints structured expanded human-readable output')
  .option('--debug', 'prints low-level timing, negotiation, and raw protocol details')
  .option('--json', 'outputs structured JSON only')
  .option('--timeout <ms>', 'request timeout', '10000')
  .action(async (url, options) => {
    try {
      const result = await auditUrl(url, {
        timeout: parseInt(options.timeout, 10),
        verbose: options.verbose,
        debug: options.debug
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderAuditOutput(result, options.verbose, options.debug));
      }
    } catch (error: any) {
      console.error('Audit failed:', error.message);
      process.exit(1);
    }
  });
