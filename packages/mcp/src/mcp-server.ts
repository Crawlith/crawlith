import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  PluginLoader,
  type CrawlithPlugin,
  type PluginContext,
  type PluginMcpPrompt,
  type PluginMcpTool
} from '@crawlith/core';
import { registerPrompts } from './prompts.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);

/**
 * Resolve the Crawlith CLI entrypoint from dependency install first,
 * then fall back to the local monorepo build path for development.
 *
 * @returns Absolute path to CLI JavaScript entrypoint.
 */
function resolveDefaultCliEntrypoint(): string {
  try {
    // Try to resolve the package itself first (works if installed as npm dependency)
    return require.resolve('@crawlith/cli/dist/index.js');
  } catch {
    // Fallback to local paths for monorepo development
    const localPath = path.resolve(workspaceRoot, 'packages/cli/dist/index.js');
    if (fs.existsSync(localPath)) return localPath;
    
    // Last resort fallback
    return path.resolve(workspaceRoot, 'packages/cli/src/index.ts');
  }
}

const defaultCliEntrypoint = resolveDefaultCliEntrypoint();

/**
 * Resolve the CLI invocation used by MCP tools.
 *
 * The command can be overridden by setting `CRAWLITH_CLI_COMMAND` to a
 * shell-like string, for example: `node /absolute/path/to/index.js`.
 *
 * @returns Executable file and static arguments.
 */
function resolveCliCommand(): { file: string; args: string[] } {
  const configured = process.env.CRAWLITH_CLI_COMMAND?.trim();
  if (!configured) {
    // Use tsx if pointing to a .ts file, otherwise use node
    const isTs = defaultCliEntrypoint.endsWith('.ts');
    return {
      file: isTs ? 'npx' : process.execPath,
      args: isTs ? ['tsx', defaultCliEntrypoint] : [defaultCliEntrypoint]
    };
  }

  const tokens = configured.split(/\s+/).filter(Boolean);
  const [file, ...args] = tokens;
  return { file, args };
}

/**
 * Build a CLI argument list by prepending global JSON format output.
 *
 * @param commandArgs Command-specific arguments.
 * @returns Combined argument list for `crawlith` invocation.
 */
function withJsonOutput(commandArgs: string[]): string[] {
  return ['--format', 'json', ...commandArgs];
}

/**
 * Run the Crawlith CLI and parse its output.
 *
 * @param commandArgs Command arguments (without global format flags).
 * @returns Parsed JSON payload or raw stdout when JSON parsing fails.
 */
async function runCliCommand(commandArgs: string[]): Promise<unknown> {
  const cli = resolveCliCommand();
  const args = [...cli.args, ...withJsonOutput(commandArgs)];

  try {
    const { stdout, stderr } = await execFileAsync(cli.file, args, {
      cwd: process.cwd(), // Run in current working directory, not monorepo root
      env: process.env,
      maxBuffer: 50 * 1024 * 1024 // 50MB for large crawl graphs
    });

    if (stderr?.trim()) {
      // Log warnings to stderr (visible in Claude Desktop logs) but don't throw if stdout exists
      console.error(`CLI Warning: ${stderr.trim()}`);
    }

    const trimmed = stdout.trim();
    if (!trimmed) {
      return { status: 'success', message: 'Command completed with no output' };
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  } catch (error: any) {
  // Handle execution failure (non-zero exit code)
  const message = error.stderr?.trim() || error.message || 'Unknown CLI error';
  throw new Error(`Crawlith CLI Error: ${message}`, { cause: error });
  }}

/**
 * Convert unknown CLI results into MCP text content.
 *
 * @param payload Result returned from `runCliCommand`.
 * @returns MCP-compatible content envelope.
 */
function asTextContent(payload: unknown): { content: Array<{ type: 'text'; text: string }> } {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return {
    content: [{ type: 'text', text }]
  };
}


/**
 * Execute a command and return stdout/stderr as utf8 text.
 *
 * @param file Executable name or path.
 * @param args Argument list.
 * @returns Process output object.
 */
async function runProcess(file: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(file, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 50 * 1024 * 1024
  });
}

/**
 * Verify Crawlith CLI availability and optionally install it if absent.
 *
 * @param installWhenMissing Whether to install `@crawlith/cli` if version check fails.
 * @param packageManager Package manager to execute installation with.
 * @returns Installation/check report.
 */
async function ensureCliAvailable(
  installWhenMissing: boolean,
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
): Promise<{ installed: boolean; checkedWith: string; installAttempted: boolean; installOutput?: string }> {
  const cli = resolveCliCommand();
  try {
    await runProcess(cli.file, [...cli.args, '--version']);
    return {
      installed: true,
      checkedWith: `${cli.file} ${cli.args.join(' ')}`.trim(),
      installAttempted: false
    };
  } catch (initialError) {
    if (!installWhenMissing) {
      return {
        installed: false,
        checkedWith: `${cli.file} ${cli.args.join(' ')}`.trim(),
        installAttempted: false,
        installOutput: String(initialError)
      };
    }

    const installArgsByManager: Record<'npm' | 'pnpm' | 'yarn' | 'bun', string[]> = {
      npm: ['install', '@crawlith/cli', '--no-save'],
      pnpm: ['add', '@crawlith/cli', '--no-save'],
      yarn: ['add', '@crawlith/cli', '--no-lockfile'],
      bun: ['add', '@crawlith/cli']
    };

    const installArgs = installArgsByManager[packageManager];
    const installResult = await runProcess(packageManager, installArgs);

    await runProcess(cli.file, [...cli.args, '--version']);
    return {
      installed: true,
      checkedWith: `${cli.file} ${cli.args.join(' ')}`.trim(),
      installAttempted: true,
      installOutput: [installResult.stdout, installResult.stderr].filter(Boolean).join('\n').trim()
    };
  }
}

/**
 * Discover plugin-provided MCP tools and prompts.
 *
 * @returns Plugin MCP definitions merged from declarative and hook-based discovery.
 */
async function discoverPluginMcpDefinitions(): Promise<{
  tools: PluginMcpTool[];
  prompts: PluginMcpPrompt[];
}> {
  const loader = new PluginLoader();
  const tools: PluginMcpTool[] = [];
  const prompts: PluginMcpPrompt[] = [];

  // Discover from multiple potential roots
  const roots = new Set<string>([
    workspaceRoot, // Monorepo root (dev)
    process.cwd(), // Current project directory
    path.join(os.homedir(), '.crawlith') // Global crawlith config dir
  ]);

  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    
    const plugins = await loader.discover(root);
    for (const plugin of plugins) {
      // Avoid duplicates if same plugin found in multiple roots
      if (plugin.mcp?.tools?.length) {
        for (const t of plugin.mcp.tools) {
           if (!tools.some(existing => existing.name === t.name)) tools.push(t);
        }
      }
      if (plugin.mcp?.prompts?.length) {
        for (const p of plugin.mcp.prompts) {
           if (!prompts.some(existing => existing.name === p.name)) prompts.push(p);
        }
      }

      if (plugin.hooks?.onMcpDiscovery) {
        const context: PluginContext = createPluginDiscoveryContext(plugin, tools, prompts);
        await plugin.hooks.onMcpDiscovery(context);
      }
    }
  }

  return { tools, prompts };
}

/**
 * Build a PluginContext object for MCP discovery hooks.
 *
 * @param plugin Plugin currently being discovered.
 * @param tools Aggregate tool registry.
 * @param prompts Aggregate prompt registry.
 * @returns PluginContext for `onMcpDiscovery`.
 */
function createPluginDiscoveryContext(
  plugin: CrawlithPlugin,
  tools: PluginMcpTool[],
  prompts: PluginMcpPrompt[]
): PluginContext {
  return {
    scope: 'crawl',
    command: 'mcp-discovery',
    metadata: { plugin: plugin.name },
    mcpDiscovery: {
      registerTool(tool: PluginMcpTool): void {
        tools.push(tool);
      },
      registerPrompt(prompt: PluginMcpPrompt): void {
        prompts.push(prompt);
      }
    },
    logger: {
      info(message: string): void {
        console.error(`[plugin:${plugin.name}] ${message}`);
      },
      warn(message: string): void {
        console.error(`[plugin:${plugin.name}] ${message}`);
      },
      error(message: string): void {
        console.error(`[plugin:${plugin.name}] ${message}`);
      },
      debug(message: string): void {
        console.error(`[plugin:${plugin.name}] ${message}`);
      }
    }
  };
}

/**
 * Register plugin-discovered MCP definitions on the server.
 *
 * @param mcpServer Server to register with.
 * @returns Number of registered tools and prompts.
 */
async function registerPluginMcpDefinitions(mcpServer: McpServer): Promise<{ tools: number; prompts: number }> {
  const { tools, prompts } = await discoverPluginMcpDefinitions();
  const usedNames = new Set<string>([
    'ensure_crawlith_cli',
    'crawl_site',
    'analyze_page',
    'probe_domain',
    'list_sites',
    'full_site_audit',
    'portfolio_status'
  ]);

  let toolCount = 0;
  let promptCount = 0;

  for (const tool of tools) {
    if (!tool?.name || usedNames.has(tool.name)) {
      continue;
    }
    usedNames.add(tool.name);
    mcpServer.tool(
      tool.name,
      tool.description,
      (tool.inputSchema ?? {}) as Record<string, z.ZodTypeAny>,
      async (input: Record<string, unknown>) => {
        const result = await tool.execute(input, {
          scope: 'crawl',
          command: 'mcp-tool',
          metadata: { source: 'plugin', tool: tool.name }
        });
        return asTextContent(result);
      }
    );
    toolCount += 1;
  }

  for (const prompt of prompts) {
    if (!prompt?.name || usedNames.has(prompt.name)) {
      continue;
    }
    usedNames.add(prompt.name);
    mcpServer.prompt(
      prompt.name,
      prompt.description,
      (prompt.argumentsSchema ?? {}) as Record<string, z.ZodTypeAny>,
      (input: Record<string, unknown>) => {
        const result = prompt.buildMessages(input, {
          scope: 'crawl',
          command: 'mcp-prompt',
          metadata: { source: 'plugin', prompt: prompt.name }
        });

        // Ensure roles are compatible with MCP SDK (only user and assistant supported)
        return {
          ...result,
          messages: result.messages.map(m => ({
            ...m,
            role: m.role === 'system' ? 'user' : (m.role as 'user' | 'assistant')
          }))
        };
      }
    );
    promptCount += 1;
  }

  return { tools: toolCount, prompts: promptCount };
}

const server = new McpServer({
  name: 'crawlith-mcp',
  version: '0.1.0'
});

server.tool(
  'ensure_crawlith_cli',
  'Check whether Crawlith CLI is available and optionally install @crawlith/cli when missing.',
  {
    installWhenMissing: z.boolean().default(true).describe('Install @crawlith/cli when the CLI is missing.'),
    packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun']).default('npm').describe('Package manager used for installation.')
  },
  async ({
    installWhenMissing,
    packageManager
  }: {
    installWhenMissing: boolean;
    packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  }) => {
    const result = await ensureCliAvailable(installWhenMissing, packageManager);
    return asTextContent(result);
  }
);

server.tool(
  'crawl_site',
  'Run the Crawlith crawl command to build a site graph snapshot.',
  {
    url: z.string().describe('Site URL or domain to crawl.'),
    limit: z.number().int().positive().max(50000).optional().describe('Maximum page count.'),
    depth: z.number().int().positive().max(100).optional().describe('Maximum click depth.'),
    concurrency: z.number().int().positive().max(20).optional().describe('Maximum parallel requests.'),
    noQuery: z.boolean().optional().describe('Strip query parameters while crawling.'),
    sitemap: z.string().optional().describe('Optional sitemap URL to seed crawling.')
  },
  async ({
    url,
    limit,
    depth,
    concurrency,
    noQuery,
    sitemap
  }: {
    url: string;
    limit?: number;
    depth?: number;
    concurrency?: number;
    noQuery?: boolean;
    sitemap?: string;
  }) => {
    const args = ['crawl', url];
    if (typeof limit === 'number') args.push('--limit', String(limit));
    if (typeof depth === 'number') args.push('--depth', String(depth));
    if (typeof concurrency === 'number') args.push('--concurrency', String(concurrency));
    if (noQuery) args.push('--no-query');
    if (sitemap) args.push('--sitemap', sitemap);

    const result = await runCliCommand(args);
    return asTextContent(result);
  }
);

server.tool(
  'analyze_page',
  'Analyze one URL for SEO, content, and accessibility signals using Crawlith page command.',
  {
    url: z.string().describe('Page URL to analyze.'),
    live: z.boolean().optional().describe('Perform a live crawl before analysis.'),
    module: z.enum(['all', 'seo', 'content', 'accessibility']).optional().describe('Optional module filter.')
  },
  async ({ url, live, module }: {
    url: string;
    live?: boolean;
    module?: 'all' | 'seo' | 'content' | 'accessibility';
  }) => {
    const args = ['page', url];
    if (live) args.push('--live');
    if (module === 'seo') args.push('--seo');
    if (module === 'content') args.push('--content');
    if (module === 'accessibility') args.push('--accessibility');

    const result = await runCliCommand(args);
    return asTextContent(result);
  }
);

server.tool(
  'probe_domain',
  'Inspect transport, TLS, and HTTP behavior using Crawlith probe command.',
  {
    url: z.string().describe('Domain or URL to inspect.'),
    timeoutMs: z.number().int().positive().max(120000).optional().describe('Probe request timeout in milliseconds.')
  },
  async ({ url, timeoutMs }: { url: string; timeoutMs?: number }) => {
    const args = ['probe', url];
    if (typeof timeoutMs === 'number') args.push('--timeout', String(timeoutMs));

    const result = await runCliCommand(args);
    return asTextContent(result);
  }
);

server.tool(
  'list_sites',
  'Return all tracked sites and latest snapshot summaries from Crawlith local database.',
  {},
  async () => {
    const result = await runCliCommand(['sites']);
    return asTextContent(result);
  }
);

server.tool(
  'full_site_audit',
  'Perform a complete site audit: crawl the site with standard limits and build the graph.',
  {
    url: z.string().describe('Site URL or domain to audit.')
  },
  async ({ url }: { url: string }) => {
    const args = ['crawl', url, '--limit', '2000', '--depth', '10'];
    const result = await runCliCommand(args);
    return asTextContent(result);
  }
);

server.tool(
  'portfolio_status',
  'View all tracked domains and their crawl health summary across the local database.',
  {},
  async () => {
    const result = await runCliCommand(['sites']);
    return asTextContent(result);
  }
);

registerPrompts(server);

/**
 * Connect the MCP server over stdio transport.
 *
 * @returns Promise that resolves when transport is connected.
 */
async function main(): Promise<void> {
  const discovered = await registerPluginMcpDefinitions(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  if (discovered.tools > 0 || discovered.prompts > 0) {
    console.error(`Plugin MCP discovery: ${discovered.tools} tools, ${discovered.prompts} prompts.`);
  }
  console.error('Crawlith MCP server running...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
