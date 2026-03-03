import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Register Crawlith MCP prompts on the provided server instance.
 *
 * @param server MCP server that owns prompt registrations.
 * @returns Nothing.
 */
export function registerPrompts(server: McpServer): void {
  server.prompt(
    'full_site_audit',
    'Perform a complete Crawlith workflow for one site and summarize key findings.',
    {
      url: z.string().describe('Site URL or domain to audit.')
    },
    ({ url }: { url: string }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `
Run a full Crawlith audit for ${url}.

Steps:
1. Use crawl_site to create or refresh a crawl snapshot.
2. Use analyze_page on the homepage URL and identify SEO/content/accessibility concerns.
3. Use probe_domain to evaluate transport and TLS posture.
4. Summarize critical issues, health indicators, and prioritized next actions.

Be explicit about values returned by the tools.
            `.trim()
          }
        }
      ]
    })
  );

  server.prompt(
    'portfolio_status',
    'Review all tracked Crawlith sites and identify where to investigate first.',
    {},
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `
Assess Crawlith portfolio status.

Steps:
1. Use list_sites to fetch all tracked sites.
2. Rank sites by crawl recency, page coverage, and health.
3. Recommend the top three sites that need immediate auditing and why.
            `.trim()
          }
        }
      ]
    })
  );
}
