# Crawlith - AI Agent Instructions 🧠

You are an AI agent operating within **Crawlith**, a high-performance, deterministic SEO Intelligence Engine. This pnpm monorepo powers graph-based site audits, link equity analysis, and technical SEO workflows. Adhere strictly to the rules, architecture, and workflows below to maintain consistency, security, and extensibility. **Anti-Hallucination Rule**: Ground all suggestions, code, or changes in the existing codebase, docs, or explicitly confirmed requirements. If uncertain, clarify before proceeding—do not invent features, APIs, or behaviors.

---

## 1. Monorepo Structure

| Package     | Path                | Purpose                                                                 |
|-------------|---------------------|-------------------------------------------------------------------------|
| **core**    | `packages/core`     | Core engine: Graph algorithms, BFS crawler, SQLite persistence.         |
| **cli**     | `packages/cli`      | CLI interface: Command-line tools with premium DX (Chalk, spinners).    |
| **web**     | `packages/web`      | React dashboard: Vite + Tailwind for visual reports and graphs.         |
| **server**  | `packages/server`   | REST API: Bridges core logic to web/CLI, handles auth and scaling.      |
| **plugins** | `packages/plugins`  | Modular extensions: PageRank, Soft 404 detection, content clustering.   |
** Follow** `docs/plugins/plugin-guidlines.md` for plugin development.
---

## 2. Core Architecture & Philosophy

- **Crawler**: Use BFS for deterministic discovery. Respect robots.txt, rate limits, and scope (e.g., subdomain policies).
- **Graph Engine**: Model sites as weighted directed graphs via the `Graph` class in `core`. Compute centrality with PageRank/HITS.
- **Persistence**: Store snapshots in SQLite using `better-sqlite3`. Enable diffs, trends, and incremental crawls.
- **Premium DX**: Outputs must be polished—use `chalk` for colors, `p-limit` for concurrency, `ora` for spinners.
- **Plugins**: Extend via the Plugin System. Standardize outputs with `onMetrics` (data hooks) and `onReport` (rendering hooks).

**Key Principle**: Favor modularity. OSS components (core/cli) remain self-contained; premium features (e.g., cloud queuing) layer on top without altering OSS boundaries. **No Duplication Rule**: Before adding code, search the codebase (e.g., via `grep` or IDE) for similar patterns—reuse or extend existing abstractions (e.g., `Fetcher`).

---

## 3. Safety & Security

Leverage the existing **IPGuard** and related safeguards—do not modify or bypass them:

- **IPGuard**: DNS-resolve targets pre-fetch; blocks private IPs (e.g., 10.0.0.0/8, cloud metadata).
- **RedirectController**: Limit hops (default: 2, max: 11) with cycle detection.
- **Rate Limiting**: Default 2 req/sec via Token Bucket; override only via explicit config.
- **Scope Enforcement**: Use `DomainFilter` and `SubdomainPolicy` to contain crawls.

**Rule**: Route all HTTP through `Fetcher` in core to inherit safeguards. Reference existing implementations; do not reimplement.

---

## 4. Standard Workflows

### Build & Rebuild
```bash
# Clean and rebuild monorepo
pnpm run rebuild
```
### Testing & Coverage
Vitest handles the suite via root `vitest.config.ts`. Mandatory: Run tests locally before any changes.
```
# Run tests with coverage
pnpm run test --coverage
```
## 5. Formatting & Linting
```
# Enforce ESLint/Prettier
pnpm run lint
pnpm run format  # If adding a format step
```
## 6. Documentation Standards
- Required: JSDoc/TSDoc for all namespaces, functions, interfaces, classes (new or modified).
- Format: Include @description, @param (with types), @returns, and purpose/examples.
- Tools: Use typedoc for generation; commit updates to docs/api/.

## 7. Navigation Hotspots

- Engine: `packages/core/src/crawler/` (BFS logic).
- Graphs: `packages/core/src/graph/` (PageRank, HITS).
- CLI: `packages/cli/src/commands/` (crawl/page modes).
- Plugins: `packages/core/src/plugin-system/` (hooks/registry).
- Configs: Root `package.json` (workspaces); `packages/core/src/constants.ts` (defaults like USER_AGENT).

## 8. Roadmap Reference (Optional Guidance)
For directional alignment, reference the live GitHub Issues/Milestones (e.g., github.com/yourorg/crawlith/issues). Current priorities (as of last sync—verify before acting):

- JS Rendering (Beta): Integrate Playwright for dynamic audits.
- Multi-Host Crawling: Safe cross-domain analysis with consent.
- DB Migrations: Optimize SQLite for 1M+ pages.
- UI Enhancements: Real-time graph filtering in dashboard.

**Note**: Do not hardcode or expand this—pull from external tracking to avoid staleness.

## 9. Best Practices: Avoiding Common Pitfalls

- Centralize Constants: Import from packages/core/src/constants.ts (e.g., DEFAULTS.RATE_LIMIT). No hardcoding.
- Reuse Abstractions: Leverage Fetcher for all HTTP; avoid raw undici/http modules.
- OSS Boundaries: Keep CLI/core fork-friendly—premium uses env vars/tokens, not code locks.
- Anti-Duplication: Scan for existing code (e.g., rg "pattern"); extend rather than rewrite.
- Hallucination Check: For any code/output, cross-reference against codebase/docs. If fabricating, flag and clarify.

## 10. Planning & Execution
- Before Writing Code: Always create a markdown-formatted plan with a checklist. Structure it as:
```text
## Plan for [Feature/Task]

### Checklist
- [ ] Step 1: Research existing code/docs (e.g., search for related functions).
- [ ] Step 2: Write/update unit tests (make them fail initially).
- [ ] Step 3: Implement code incrementally.
- [ ] Step 4: Run tests/lint/build to verify.
- [ ] Step 5: Document with JSDoc.
- [ ] Step 6: Propose diff for review.
```
- Update as Progress: Inline-check items (e.g., - [x] Step 1) and note any blockers/decisions. Share the updated plan before final code output.
- Why?: Ensures structured, verifiable progress; prevents untested/duplicated code.

## 11. Safety & Permissions
Always seek explicit confirmation before:

- Installing packages (pnpm add).
- Git pushes, file deletions, or chmods.
- Full builds or E2E suites.
- Committing code (propose diffs first).

## 12. PR Checklist
- Title: feat(scope): short description (e.g., feat(crawler): add BFS depth limiter).
- Pre-Commit: Lint, type-check, tests (including new/updated ones) all pass. No duplicates introduced.
- Diff: Focused (<200 lines); include CHANGELOG summary and "Why this change?" rationale.
- Cleanup: Remove debug logs/comments; ensure JSDoc is complete.
- Confirmation: Share proposed PR/draft for review before finalizing.

## 13. When Stuck or Uncertain
- Ask a clarifying question, propose a 3-step plan, or open a draft PR with notes/questions.
- Do not push speculative, large, or untested changes—break into small, verifiable increments.

## 14. Strict Test-First Mode

- New Features/Changes: Write or update unit tests first (make them fail), then code until green. Cover edge cases (e.g., SSRF triggers).
- UI Changes: Use component tests for state/props.
- Bugs/Regressions: Add a failing repro test immediately, then fix to green. No fixes without tests.
- Coverage Goal: Aim for 90%+ on new code; run pnpm test --coverage to verify.
- No Commit Without Tests: Treat untested code as invalid—pause and test before proposing.

---

**Deterministic Crawl Intelligence. Shift-Left SEO.**