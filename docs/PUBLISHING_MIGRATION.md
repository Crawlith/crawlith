# Publishing Strategy & Registry Availability

Crawlith is organized as a monorepo. While many packages exist in the `packages/` directory, only a subset are published to the public npm registry.

## Canonical Public Packages

These packages are available on npm and are the primary entry points for users and integrators:

- **`@crawlith/cli`**: The primary CLI tool. Includes the `crawlith` binary and bundles the web dashboard and internal plugins.
- **`@crawlith/core`**: The headless intelligence engine. Used as a library by the CLI and MCP server.
- **`@crawlith/mcp`**: The Model Context Protocol server bridge, enabling AI agents (like Claude) to use Crawlith tools.

## Internal (Private) Packages

The following packages are marked as `"private": true` and are **not** published to npm. They are bundled into `@crawlith/cli` during the build process to provide a single-binary experience:

- `@crawlith/web`: The React dashboard.
- `@crawlith/server`: The Express API server.
- `@crawlith/plugin-exporter`: Internal export logic.
- `@crawlith/plugin-reporter`: Internal reporting logic.
- `@crawlith/plugin-signals`: SEO signal analysis.
- `@crawlith/architecture-infrastructure`: Internal adapter layer.

## Dependency Management

To ensure a smooth installation for end-users, we follow these rules:

1. **Public dependencies**: `@crawlith/cli` and `@crawlith/mcp` list `@crawlith/core` in their `dependencies` section.
2. **Bundled dependencies**: All private workspace packages (plugins, web, server) are listed in `devDependencies` of the CLI and are bundled using `tsup`'s `noExternal` configuration. This prevents npm from attempting to resolve private packages from the public registry during user installation.
3. **Workspace versioning**: We use `workspace:*` for internal cross-package dependencies to ensure they always sync during development.

## Release Workflow

1. **Build**: `pnpm build` (compiles all packages and bundles the CLI).
2. **Test**: `pnpm test` (verifies integrity across the monorepo).
3. **Version**: `pnpm changeset version` (bumps versions based on pending changesets).
4. **Publish**: `pnpm release` (publishes the public packages to the npm registry).

## Registry Verification

Before publishing, verify that no public package has a private package in its `dependencies` list (unless it's explicitly handled by the bundler and excluded from the published `package.json`).
