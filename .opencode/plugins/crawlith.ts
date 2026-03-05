import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

/**
 * Resolve the Crawlith CLI entrypoint.
 *
 * @returns Absolute path to CLI JavaScript entrypoint.
 */
function resolveCliEntrypoint(): string {
  try {
    // Try to resolve from monorepo packages first
    return require.resolve('../../packages/cli/dist/index.js');
  } catch {
    try {
      // Try to resolve the package itself (works if installed as npm dependency)
      return require.resolve('@crawlith/cli/dist/index.js');
    } catch {
      // Fallback to local paths
      const localPath = path.resolve(workspaceRoot, 'packages/cli/dist/index.js');
      if (fs.existsSync(localPath)) return localPath;
      
      return path.resolve(workspaceRoot, 'packages/cli/src/index.ts');
    }
  }
}

const CLI_PATH = resolveCliEntrypoint();

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
  const isTs = CLI_PATH.endsWith('.ts');
  const runner = isTs ? 'npx tsx' : 'node';
  const command = `${runner} ${CLI_PATH} --format json ${commandArgs}`;
  
  try {
    const result = await $`sh -c ${command}`;
    return await result.text();
  } catch (error: any) {
    const message = error.stderr?.trim() || error.message || 'Unknown CLI error';
    throw new Error(`Crawlith CLI Error: ${message}`, { cause: error });
  }
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
          concurrency: tool.schema.number().optional().describe('Max concurrent requests'),
          health: tool.schema.boolean().optional().describe('Run health score analysis'),
          pagerank: tool.schema.boolean().optional().describe('Compute PageRank scores'),
          hits: tool.schema.boolean().optional().describe('Compute HITS (Hubs and Authorities) scores')
        },
        async execute({ url, limit, depth, concurrency, health, pagerank, hits }: any) {
          const args = ['crawl', url];
          if (typeof limit === 'number') args.push('--limit', String(limit));
          if (typeof depth === 'number') args.push('--depth', String(depth));
          if (typeof concurrency === 'number') args.push('--concurrency', String(concurrency));
          if (health) args.push('--health');
          if (pagerank) args.push('--compute-pagerank');
          if (hits) args.push('--compute-hits');

          return runCli($, args.join(' '));
        }
      }),

      'crawlith-analyze-page': tool({
        description: 'Analyze a single page URL for SEO, content, and accessibility signals.',
        args: {
          url: tool.schema.string().describe('Page URL to analyze'),
          live: tool.schema.boolean().optional().describe('Run with --live flag')
        },
        async execute({ url, live }: any) {
          const args = ['page', url];
          if (live) args.push('--live');
          return runCli($, args.join(' '));
        }
      }),

      'crawlith-probe-domain': tool({
        description: 'Inspect TLS/transport and HTTP behavior for a domain or URL.',
        args: {
          url: tool.schema.string().describe('Domain or URL to inspect'),
          timeout: tool.schema.number().optional().describe('Probe timeout in milliseconds')
        },
        async execute({ url, timeout }: any) {
          const args = ['probe', url];
          if (typeof timeout === 'number') args.push('--timeout', String(timeout));
          return runCli($, args.join(' '));
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
