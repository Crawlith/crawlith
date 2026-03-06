#!/usr/bin/env node
import chalk from './utils/chalk.js';
import { version } from './utils/version.js';
import { buildProgram, maybeNotifyForUpdates } from './bootstrap.js';

function installCancellationHandlers(): void {
  // Let the UI command manage its own SIGINT/SIGTERM shutdown lifecycle.
  const isUiCommand = process.argv.slice(2).includes('ui');
  if (isUiCommand) return;

  let cancelling = false;
  const cancel = () => {
    if (cancelling) return;
    cancelling = true;
    // Keep this plain and stable for scripts.
    console.log('\nOperation canceled.');
    process.exit(0);
  };

  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
}

async function bootstrap() {
  installCancellationHandlers();
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
