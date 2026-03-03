# @crawlith/mcp

MCP server that exposes Crawlith CLI workflows as MCP tools for Claude Desktop.

## Tools

- `ensure_crawlith_cli` — checks whether Crawlith CLI is available and can install `@crawlith/cli` if missing
- `crawl_site` — wraps `crawlith crawl`
- `analyze_page` — wraps `crawlith page`
- `probe_domain` — wraps `crawlith probe`
- `list_sites` — wraps `crawlith sites`

## Prompts

- `full_site_audit`
- `portfolio_status`

## Plugin MCP Discovery

`@crawlith/mcp` now discovers plugin-provided MCP tools and prompts at startup:

- Declarative: plugins can expose `plugin.mcp.tools` and `plugin.mcp.prompts`
- Hook-based: plugins can implement `hooks.onMcpDiscovery(ctx)` and register through `ctx.mcpDiscovery.registerTool(...)` / `ctx.mcpDiscovery.registerPrompt(...)`

## Package dependency

This package depends on `@crawlith/cli`, so when `@crawlith/mcp` is published and installed from npm, it can resolve the Crawlith CLI entrypoint from `node_modules`.

## Run

```bash
pnpm --filter @crawlith/mcp run mcp
```

By default, the server resolves and executes the installed `@crawlith/cli` entrypoint.
When developing inside this monorepo, it falls back to `packages/cli/dist/index.js`.

Override either behavior with `CRAWLITH_CLI_COMMAND` if you need a custom CLI command.

## Claude Desktop configuration

Add the server to `claude_desktop_config.json` with an absolute path:

```json
{
  "mcpServers": {
    "crawlith": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/crawlith/packages/mcp/src/mcp-server.ts"
      ]
    }
  }
}
```
