# Publishing Migration Notes (Option B)

This repository now uses `packages/*` as the canonical npm publish roots.

## Canonical public packages

- `packages/core` → `@crawlith/core`
- `packages/cli` → `@crawlith/cli`

## Internal implementation packages

- `plugins/core` → `@crawlith/internal-core` (private)
- `plugins/cli` → `@crawlith/internal-cli` (private)

These internal packages are built/tested through the public packages' scripts so the publish surface stays stable while source migration continues.

## Root command wiring

The root `crawlith` bin and script now execute from `packages/cli/dist/index.js`.

## Release checklist

1. Build public packages:
   - `pnpm build`
2. Test public packages:
   - `pnpm test`
3. Verify CLI entrypoint:
   - `pnpm crawlith crawl --help`
4. Publish via changesets:
   - `pnpm release`

## Next phase

After this stabilization phase, migrate source ownership from `plugins/*` to `packages/*` and remove bridge/copy steps from `packages/core` and `packages/cli` build scripts.
