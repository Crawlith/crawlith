# Installation

There are three ways to use Crawlith: as a global tool, as a one-off command, or as a project dependency.

## Install Globally

If you want to use the `crawlith` command from anywhere on your system, install it globally:

<CodeGroup>
```bash npm
npm install -g crawlith
```

```bash pnpm
pnpm add -g crawlith
```

```bash bun
bun add -g crawlith
```
</CodeGroup>

## Run without Installing

For one-off audits, you can use a package runner without adding any files to your system:

<CodeGroup>
```bash npx
npx crawlith crawl https://example.com
```

```bash pnpm
pnpm dlx crawlith crawl https://example.com
```

```bash bun
bunx crawlith crawl https://example.com
```
</CodeGroup>

## Verify Installation

Check if Crawlith is correctly installed and view its current version:

```bash
crawlith --version
```

## System Requirements

*   **Node.js**: v18 or later.
*   **Disk Space**: At least 100MB (for local crawl storage in `~/.crawlith`).
*   **Network**: Active internet connection required to crawl live sites.
