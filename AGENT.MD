# Crawlith — AI Agent Instructions

You are an AI agent working inside the **Crawlith** monorepo: a deterministic SEO Intelligence Engine built on graph-based site audits, BFS crawling, and SQLite persistence.

## Anti-Hallucination Contract

Before writing any code, suggestion, or plan:
- Ground every decision in the **existing codebase, these instructions, or an explicitly confirmed requirement**.
- If you cannot find something in the codebase, say so and ask — do not invent it.
- If you are unsure which abstraction to extend, stop and ask before writing new code.
- Never fabricate API signatures, file paths, or behavior. If uncertain, grep first.

---

## 1. Monorepo Layout

| Package | Path | Owns |
|---|---|---|
| `core` | `packages/core` | BFS crawler, Graph engine, SQLite persistence, Fetcher, IPGuard |
| `cli` | `packages/cli` | Commands, terminal output (Chalk, Ora, spinners) |
| `web` | `packages/web` | React dashboard (Vite + Tailwind) |
| `server` | `packages/server` | REST API, auth, scaling |
| `plugins` | `packages/plugins` | PageRank, Soft 404, content clustering |

**Package boundaries are enforced:**
- HTTP logic belongs in `core/Fetcher` — not in `cli`, `server`, or plugins.
- BFS logic belongs in `packages/core/src/crawler/`.
- Graph algorithms belong in `packages/core/src/graph/`.
- CLI commands are thin wrappers — no business logic.
- Plugins only interact with core via `onMetrics` and `onReport` hooks.

For plugin development, follow `docs/plugins/plugin-guidelines.md` exactly.
For PR Review, follow `docs/PR-REVIEW-GUIDELINES.md` exactly.

---

## 2. Non-Negotiable Architecture Rules

**Before writing any code, grep for existing implementations.**

1. **All HTTP goes through `core/Fetcher`.** Never use raw `undici`, `http`, or `fetch` directly. `Fetcher` inherits `IPGuard`, rate limiting, and redirect control automatically.

2. **No hardcoded constants.** All defaults (rate limits, user agent, timeouts, etc.) come from `packages/core/src/constants.ts`. Import, don't redefine.

3. **No duplication.** Run `rg "pattern"` before building anything new. Extend `Fetcher`, `Graph`, `DomainFilter`, `IPGuard` — don't reimplement them.

4. **OSS/premium boundary.** `core` and `cli` must remain fork-friendly. Premium features are gated via env vars or tokens, never via code locks inside OSS packages.

5. **Plugins via hooks only.** Plugins must use `onMetrics` (data) and `onReport` (render) — no direct imports from core internals.

---

## 3. Safety & Security — Do Not Touch

These are production safeguards. Do not modify, bypass, or reimplement them:

- **`IPGuard`** — DNS-resolves all targets pre-fetch; blocks private IPs and cloud metadata endpoints.
- **`RedirectController`** — Max 11 hops, default 2, with cycle detection.
- **Token Bucket** — Default 2 req/sec. Override only via explicit user config, never in code.
- **`DomainFilter` + `SubdomainPolicy`** — Contain crawl scope. Do not widen without explicit config.

If a task requires touching any of these, **stop and confirm with the user first.**

---

## 4. Commands

```bash
# Rebuild monorepo
pnpm run rebuild

# Run tests with coverage (required before any change)
pnpm run test --coverage

# Lint and format
pnpm run lint
pnpm run format
```

---

## 5. Before Writing Any Code

Always produce a plan first. Do not skip this.

```
## Plan: [Feature or Task Name]

### What exists already
- (grep results, relevant files, abstractions that apply)

### What changes
- [ ] Write/update failing tests first
- [ ] Implement incrementally
- [ ] Run pnpm test --coverage — must stay at 90%+
- [ ] Run pnpm run lint
- [ ] Add JSDoc to all new/modified public APIs
- [ ] Propose diff for review

### Decisions / open questions
- (anything that needs confirmation before proceeding)
```

Check items inline as you go (`- [x]`). Share the updated plan before submitting code.

---

## 6. Test-First. Always.

- **New feature** → write failing tests first, then implement until green.
- **Bug fix** → add a failing repro test, then fix to green.
- **UI change** → component tests covering state and props.
- **Coverage target** → 90%+ on all new code. Verify with `pnpm test --coverage`.
- **Untested code is not done.** Do not propose a diff without tests.

Edge cases that must always be covered in crawler/graph code:
- SSRF triggers (private IPs, cloud metadata URLs)
- Redirect cycles
- Robots.txt blocking
- Empty or malformed responses

---

## 7. Documentation Requirements

Required for every new or modified public API:

```ts
/**
 * @description What this does and why.
 * @param name - Type and meaning.
 * @returns What is returned and when.
 * @example
 * const result = myFunction(input);
 */
```

- Generate API docs with `typedoc`; commit output to `docs/api/`.
- Update `README` or relevant `docs/` page for any user-facing CLI flag, command, or plugin hook.
- Internal refactors do not require doc updates — only public surface changes.

---

## 8. Permissions — Always Ask First

Do not perform any of the following without explicit user confirmation:

- `pnpm add` (installing packages)
- Git commits, pushes, or branch operations
- File deletions or permission changes (`chmod`)
- Full builds or E2E test runs
- Any change to `IPGuard`, `RedirectController`, or Token Bucket defaults

When in doubt: propose, don't act.

---

## 9. PR Requirements

**Title format:** `feat(scope): short description`
Examples: `feat(crawler): add BFS depth limiter`, `fix(graph): correct PageRank normalization`

**Before opening a PR:**
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test --coverage` passes at 90%+
- [ ] Diff is focused — under 200 lines. If larger, split it.
- [ ] No `console.log`, debug statements, or commented-out code
- [ ] JSDoc complete on all new/modified public APIs
- [ ] CHANGELOG entry included
- [ ] "Why this change?" written in PR description
- [ ] No new `pnpm` dependencies without prior confirmation

Share as a draft PR for review before finalizing.

---

## 10. When Stuck

1. Search the codebase first (`rg`, `grep`).
2. Re-read the relevant section of these instructions.
3. If still unclear: ask one specific question or open a draft PR with your question in the description.

Do not push speculative or large untested changes. Break work into small, verifiable increments.

---

## 11. Roadmap (Direction Only — Verify Before Acting)

Pull current status from GitHub Issues before starting roadmap work. Do not treat this list as confirmed scope.

- **JS Rendering (Beta)** — Playwright integration for dynamic page audits
- **Multi-Host Crawling** — Safe cross-domain analysis with consent model
- **DB Migrations** — SQLite optimization for 1M+ page datasets
- **UI Enhancements** — Real-time graph filtering in the dashboard

---

*Deterministic Crawl Intelligence. Shift-Left SEO.*