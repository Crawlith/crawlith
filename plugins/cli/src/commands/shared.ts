import { Argv } from 'yargs';

export function withOutputOptions(y: Argv) {
  return y
    .option('format', {
      choices: ['pretty', 'json'] as const,
      default: 'pretty',
      describe: 'Output format'
    })
    .option('log-level', {
      choices: ['normal', 'verbose', 'debug'] as const,
      default: 'normal',
      describe: 'Log level'
    })
    // Legacy flags
    .option('json', {
      type: 'boolean',
      describe: 'Use JSON output (deprecated, use --format=json)',
      hidden: true
    })
    .option('debug', {
      type: 'boolean',
      describe: 'Use debug logging (deprecated, use --log-level=debug)',
      hidden: true
    })
    .option('verbose', {
      type: 'boolean',
      describe: 'Use verbose logging (deprecated, use --log-level=verbose)',
      hidden: true
    })
    .middleware((argv) => {
      if (argv.json) argv.format = 'json';
      if (argv.debug) argv['log-level'] = 'debug';
      if (argv.verbose) argv['log-level'] = 'verbose';
      if (argv.format === 'text') argv.format = 'pretty';
    });
}

export function withExportOption(y: Argv) {
  return y.option('export', {
    describe: 'Export formats (comma-separated: json,markdown,csv,html,visualize)',
    // We do not enforce type: 'string' to allow the flag to be used as a boolean (defaulting to json in handlers)
  });
}
