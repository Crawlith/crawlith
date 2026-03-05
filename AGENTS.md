# Repository Guidelines

## Project Structure & Module Organization
Crawlith is a `pnpm` monorepo. Primary code lives in `packages/`:
- `packages/core`: crawler engine, graph algorithms, scoring, SQLite layer.
- `packages/cli`: `crawlith` command interface and command registry.
- `packages/server`: Express API bridge used by local UI flows.
- `packages/web`: React + Vite dashboard.
- `packages/plugins/*`: optional intelligence plugins (signals, pagespeed, reporter, exporter).

Docs and process files are in `docs/`, tests are colocated per package (`packages/*/tests`), and generated outputs (`dist/`, `coverage/`) should not be edited directly.

## Build, Test, and Development Commands
Use Node.js 20+ and `pnpm`.
- `pnpm install`: install workspace dependencies.
- `pnpm build`: build all packages.
- `pnpm test`: run all package test suites via Vitest.
- `pnpm lint`: run ESLint across the repository.
- `pnpm crawlith -- crawl https://example.com --limit 100`: run built CLI locally.
- `pnpm --filter @crawlith/web dev`: run the dashboard in dev mode.

## Coding Style & Naming Conventions
TypeScript + ESM is standard. Follow existing patterns:
- 2-space indentation in TS/TSX source.
- Prefer named exports and small focused modules.
- Keep file naming consistent with nearby code (`camelCase` utilities, PascalCase React components).
- Include `.js` extension in local TypeScript import paths (runtime ESM compatibility).
- Run `pnpm lint` before opening a PR.

## Testing Guidelines
Vitest is the test framework (`vitest.config.ts` at root and package level).
- Add tests next to the affected package under `tests/`.
- Name tests `*.test.ts`.
- Prefer deterministic unit tests; mock external/network behavior.
- Run focused tests while iterating, then `pnpm test` before submission.
- Coverage reporters are enabled (text/json/html); target high coverage for new core and CLI logic.

## Commit & Pull Request Guidelines
Follow conventional-style commit messages seen in history:
- `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `chore: ...`, `style(scope): ...`.

For PRs:
- Keep scope tight and explain why the change is needed.
- Link related issue(s) and call out package impact (`core`, `cli`, `web`, `server`, `plugins`).
- Include tests for behavior changes and screenshots/GIFs for UI changes.
- Ensure `pnpm lint`, `pnpm test`, and `pnpm build` pass locally.
