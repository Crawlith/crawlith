import { CrawlEvent } from '@crawlith/core';
import chalk from '../utils/chalk.js';

export interface OutputOptions {
  format: 'pretty' | 'json';
  logLevel: 'normal' | 'verbose' | 'debug';
}

export class OutputController {
  constructor(private options: OutputOptions) {}

  handle(event: CrawlEvent) {
    if (this.options.format === 'json') return;

    switch (event.type) {
      case 'crawl:start':
        if (this.options.logLevel === 'debug') {
          console.log(chalk.gray(`Starting crawl for ${event.url}`));
        } else if (this.options.logLevel === 'verbose') {
          console.log(chalk.gray(`> ${event.url}`));
        }
        break;
      case 'crawl:success':
        if (this.options.logLevel === 'debug') {
          console.log(`${chalk.gray(`[D:${event.depth}]`)} ${event.status} ${chalk.blue(event.url)} (${event.durationMs}ms)`);
        } else if (this.options.logLevel === 'verbose') {
          console.log(`${chalk.green(event.status)} ${event.url}`);
        }
        break;
      case 'crawl:error':
        console.error(chalk.red(`Error processing ${event.url}: ${event.error}`));
        break;
      case 'queue:enqueue':
        if (this.options.logLevel === 'debug') {
           console.log(chalk.gray(`Enqueued ${event.url} (depth ${event.depth})`));
        }
        break;
      case 'metrics:start':
        if (this.options.logLevel !== 'normal') {
           console.log(chalk.blue(`Use metrics: ${event.phase}...`));
        }
        break;
      case 'metrics:complete':
        if (this.options.logLevel !== 'normal') {
           console.log(chalk.green('Metrics calculation complete.'));
        }
        break;
      case 'info':
        console.log(chalk.blue(event.message));
        break;
      case 'warn':
        console.warn(chalk.yellow(event.message));
        break;
      case 'error':
        console.error(chalk.red(event.message));
        if (event.error && this.options.logLevel === 'debug') {
             console.error(event.error);
        }
        break;
      case 'debug':
        if (this.options.logLevel === 'debug') {
            console.log(chalk.gray(`[DEBUG] ${event.message}`), event.context || '');
        }
        break;
      case 'crawl:limit-reached':
        console.log(chalk.yellow(`Crawl limit of ${event.limit} pages reached.`));
        break;
    }
  }

  renderResult<T>(result: T, prettyRenderer?: (result: T) => string) {
    if (this.options.format === 'json') {
      process.stdout.write(JSON.stringify(result, null, 2));
      return;
    }

    if (prettyRenderer) {
      console.log(prettyRenderer(result));
    }
  }
}
