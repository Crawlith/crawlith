#!/usr/bin/env node
import chalk from 'chalk';
import { version } from './utils/version.js';
import { buildProgram, maybeNotifyForUpdates } from './bootstrap.js';

async function bootstrap() {
  maybeNotifyForUpdates(process.argv);
  const { program } = await buildProgram();

  program.configureHelp({
    padWidth() {
      return 28;
    },
  });

  const banner = `
  ██████╗██████╗  █████╗ ██╗    ██╗██╗     ██╗████████╗██╗  ██╗ ${version}
 ██╔════╝██╔══██╗██╔══██╗██║    ██║██║     ██║╚══██╔══╝██║  ██║
 ██║     ██████╔╝███████║██║ █╗ ██║██║     ██║   ██║   ███████║
 ██║     ██╔══██╗██╔══██║██║███╗██║██║     ██║   ██║   ██╔══██║
 ╚██████╗██║  ██║██║  ██║╚███╔███╔╝███████╗██║   ██║   ██║  ██║
  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝
`;
  const isCompletionInvocation = process.argv.includes('__complete') || process.argv.includes('completion');

  if (process.argv.length <= 2 && !isCompletionInvocation) {
    console.log(chalk.cyanBright('\n' + banner));
    console.log(chalk.gray('Crawlith — Deterministic crawl intelligence.\n'));
    program.help();
  } else if ((process.argv.includes('--help') || process.argv.includes('-h')) && !isCompletionInvocation) {
    console.log(chalk.cyanBright('\n' + banner));
    console.log(chalk.gray('Crawlith — Deterministic crawl intelligence.\n'));
  }

  program.parse(process.argv);
}

bootstrap().catch(err => {
  console.error(chalk.red('Fatal error during bootstrap:'), err);
  process.exit(1);
});
