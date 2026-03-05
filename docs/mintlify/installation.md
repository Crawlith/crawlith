# Installation

The recommended way to use Crawlith is by installing it globally. This makes the `crawlith` command available directly in your terminal.

## Global Installation

Install Crawlith globally using your preferred package manager:

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

## Verify Installation

Once installed, you can run the binary directly:

```bash
crawlith --version
```

## Update Notifications

Crawlith includes a built-in update notifier. When a new version is published to npm, the CLI will automatically notify you in the terminal with instructions on how to upgrade, ensuring you always have the latest features and bug fixes.

## Running without Installation (On-demand)

If you prefer not to install the binary globally, you can use these on-demand runners:

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
