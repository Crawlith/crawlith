import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../packages/cli/dist/index.js');

/**
 * Execute a Crawlith CLI command in JSON mode.
 *
 * @param $ OpenCode shell helper.
 * @param commandArgs Command arguments excluding global JSON format flags.
 * @returns Command output text.
 */
async function runCli(
  $: { (strings: TemplateStringsArray, ...values: any[]): Promise<{ text(): Promise<string> }> },
  commandArgs: string
): Promise<string> {
  const command = `node ${CLI_PATH} --format json ${commandArgs}`;
  const result = await $`sh -c ${command}`;
  return result.text();
}

/**
 * Crawlith OpenCode plugin exposing Crawlith CLI tools and useful lifecycle hooks.
 */
export const CrawlithPlugin: Plugin = async ({ project, client, $, directory }: any) => {
  await client.app.log({
    body: {
      service: 'crawlith-plugin',
      level: 'info',
      message: `Initialized for project: ${project.name}`
    }
  });

  return {
    tool: {
      'crawlith-crawl-site': tool({
        description: 'Crawl an entire site and build Crawlith graph snapshot data.',
        args: {
          url: tool.schema.string().describe('Site URL or domain to crawl'),
          limit: tool.schema.number().optional().describe('Maximum number of pages to crawl'),
          depth: tool.schema.number().optional().describe('Maximum click depth'),
          concurrency: tool.schema.number().optional().describe('Max concurrent requests')
        },
        async execute({ url, limit, depth, concurrency }: any) {
          const flags = [
            typeof limit === 'number' ? `--limit ${limit}` : '',
            typeof depth === 'number' ? `--depth ${depth}` : '',
            typeof concurrency === 'number' ? `--concurrency ${concurrency}` : ''
          ]
            .filter(Boolean)
            .join(' ');

          return runCli($, `crawl ${url} ${flags}`.trim());
        }
      }),

      'crawlith-analyze-page': tool({
        description: 'Analyze a single page URL for SEO, content, and accessibility signals.',
        args: {
          url: tool.schema.string().describe('Page URL to analyze'),
          live: tool.schema.boolean().optional().describe('Run with --live flag')
        },
        async execute({ url, live }: any) {
          const flags = live ? '--live' : '';
          return runCli($, `page ${url} ${flags}`.trim());
        }
      }),

      'crawlith-probe-domain': tool({
        description: 'Inspect TLS/transport and HTTP behavior for a domain or URL.',
        args: {
          url: tool.schema.string().describe('Domain or URL to inspect'),
          timeout: tool.schema.number().optional().describe('Probe timeout in milliseconds')
        },
        async execute({ url, timeout }: any) {
          const flags = typeof timeout === 'number' ? `--timeout ${timeout}` : '';
          return runCli($, `probe ${url} ${flags}`.trim());
        }
      }),

      'crawlith-list-sites': tool({
        description: 'List all tracked sites from Crawlith local storage.',
        args: {},
        async execute() {
          return runCli($, 'sites');
        }
      })
    },

    event: async ({ event }: any) => {
      if (event.type === 'session.idle') {
        await client.app.log({
          body: {
            service: 'crawlith-plugin',
            level: 'info',
            message: 'Session reached idle state.'
          }
        });
      }
    },

    'tool.execute.before': async (input: any) => {
      await client.app.log({
        body: {
          service: 'crawlith-plugin',
          level: 'debug',
          message: `Tool called: ${input.tool}`
        }
      });
    },

    'tool.execute.after': async (input: any, output: any) => {
      const crawlithTools = new Set([
        'crawlith-crawl-site',
        'crawlith-analyze-page',
        'crawlith-probe-domain',
        'crawlith-list-sites'
      ]);

      if (!crawlithTools.has(input.tool)) {
        return;
      }

      const reportsDir = path.join(directory, 'crawlith-opencode-reports');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(reportsDir, `${input.tool}-${timestamp}.json`);

      await $`mkdir -p ${reportsDir}`;
      await $`sh -c ${`cat > ${reportPath} <<'JSON'\n${JSON.stringify(output.output, null, 2)}\nJSON`}`;

      await client.app.log({
        body: {
          service: 'crawlith-plugin',
          level: 'info',
          message: `Saved tool output: ${reportPath}`
        }
      });
    }
  };
};
