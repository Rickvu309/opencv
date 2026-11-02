## Agent skills

### Issue tracker

Issues live in GitHub issues of `Rickvu309/opencv`. See `docs/agents/issue-tracker.md`.

### Triage labels

Only `ready-for-human` is a label; the other triage roles are read from the issue and its PRs. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` and `docs/adr/`). See `docs/agents/domain.md`.

### Code map

- `packages/domain/src` is pure TypeScript and zod, with no database, server or AI SDK import. It holds the typed contract.
  - `<surface>-contract.ts` declares each surface's commands and most of its reads.
  - `queries.ts` joins every read and declares the chat reads, `link.get` and `workspace.search`.
- `apps/api/src/<module>/` is one product module. Other modules import it only through its `index.ts`.
  - `commands.ts` binds the module's contract commands with `bindCommands` and its reads with `tableQuery`. `account` binds its reads in `queries.ts`.
  - `job/fetch-posting.ts` is the internal-host guard. `job/store.ts` reads a posting into fields, with the Coach's `interpretPosting` when `interpretPostings` is on.
  - Only files under the module's directory write its tables, plus `auth.ts` for the auth tables (owner list: `registry/ownership.test.ts`).
- Other api folders:
  - `registry/` runs every command and builds the Coach's tools.
  - `coach/` runs a Coach turn and is the only importer of the AI SDK. It has no contract commands. See `docs/coach.md`.
- `apps/web/src/lib` is the only code that calls the api, uses `fetch` or invalidates queries (`apps/web/src/test/request-boundary.test.ts`). `contract-client.ts` owns read keys and refresh.

### Task docs

- Contract work (add or change a command, read or Coach tool): `docs/adr/0010-one-typed-contract-for-commands-and-reads.md` holds the recipe and its tests.
- Web code (cross-feature import, hover, focus, pointer, kit duplicate, nav item, Paper autosave, browser script): `docs/agents/web-guards.md`.
- Design (kit styling, registry install, pen frame or snapshot, signed-in screen layout, pricing or blog cover): `docs/agents/design-parity.md`.
- Production sign-in recovery: `docs/agents/production-recovery.md` and `scripts/verify-auth-production.mjs`.

### Code rules

- `scripts/no-comments.test.mjs` rejects any new comment in source, CSS included; use a better name or a test. `scripts/no-comments.baseline.json` only shrinks.
- `scripts/retired-words.test.mjs` rejects Thread or Opportunity in source or file names under `apps/*/src` and `packages/*/src` outside its allowed list (Inbox mail threads); say Chat or Job.
- Web test fixtures anchor to `TEST_NOW` in `apps/web/src/test/test-clock.ts`, never the real date (`scripts/web-test-clock.test.mjs`). A node test injects `timers` instead of waiting on the real clock (`packages/guards/wall-clock.test.mjs`).

### Git

Full details: `CONTRIBUTING.md` and `docs/git-workflow/`. Rules and their checks: `docs/git-workflow/rule-enforcement.md`.

#### 1. Issue first

- Start from a GitHub issue. If none exists, `scripts/ocv-tools.mjs take "Issue title"` creates it (or use the Task form).
- Split work that will take more than a few days into sub-issues and do one at a time.

#### 2. Always work in your own worktree

- Edit only in your worktree. The main checkout stays on `main` and is only used to fetch, create worktrees, and merge.
- Start every task with:
  ```bash
  scripts/ocv-tools.mjs take <issue#> -d "short description"
  scripts/ocv-tools.mjs take "Issue title"          # creates the issue first
  ```
- The worktree path is `../opencv.worktrees/<issue#>-short-description`.
- Use the port `take` prints (`PORT` in the worktree's `.env`).
- One agent, one issue, one branch, one worktree. Leave other agents' worktrees alone.

#### 3. Branch naming

- `type/<issue#>-short-description`, e.g. `feat/42-login-page`. Types: `feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`.
- Lowercase kebab-case, 3-5 words, branched from the latest `origin/main`.

#### 4. Checks, commits, and PRs

- The git hooks run the one rule table (`scripts/ocv-tools/rules`): format, file size and attribution at commit; branch name and the quick checks on changed files (about a minute) at push. CI and the merge queue are the gate for tests, types and build; `pnpm check` is the manual full run.
- Run `scripts/ocv-tools.mjs finish --body-file <file>` (add `--draft` to open a draft). Use the `pr` skill (Summary, Evidence, Merge Danger). Finish opens `type: description (#<issue>)` with `Closes #<issue>`.
- Run local checks serially; `scripts/check.mjs` caps workers at 2.
- Rebase, verify skills, drafts and the PR template: `docs/git-workflow/commit-and-pr-conventions.md`.

#### 5. Never

- Reach `main` only through a merged PR: never push to it, commit on it, or merge into it locally.
- Never use `git push --no-verify` or `git commit --no-verify`.
- `SKIP_CHECKS=1` is for a production emergency a human declared; say so in the PR.
- One account, so nothing is approved: never approve your own PR, under any identity.
- Never remove the `needs-human-review` label or edit `.github/CODEOWNERS` to get around a human review.
- Flag a big decision (dropping a product, a data-losing migration, changing pricing or the legal entity) with the `needs-human-review` label. An agent never merges a PR with that label. A mass deletion needs the label too.
- Never commit `.env` or real secrets.
- Leave issues labeled `ready-for-human` to humans.
- A change to `ci.yml`, `nightly.yml`, `.github/actions/**`, `scripts/check.mjs` or the main ruleset needs `risk:high`.

#### 6. Merge and clean up

- From the main checkout, run `scripts/ocv-tools.mjs merge <pr#>` after green `ci`. It enqueues with `--match-head-commit`; the queue runs full `ci` before squash-merging. No `--admin`, no bypass.
- After the queue accepts the PR, run `scripts/ocv-tools.mjs merge <pr#> --wait` as a background command (`run_in_background`) and end the turn. It exits when the PR merges (closing the linked issues), leaves the queue, or after 45 minutes. A PR watcher does not wake you for a queue merge. Run `scripts/ocv-tools.mjs cleanup <issue#>` from the main checkout only if it says cleanup needs a hand.

#### 7. Production is broken

- `docs/git-workflow/deploys-and-hotfixes.md` holds the hotfix branch and the rollback.

Review notes: `docs/git-workflow/review-and-approval.md`.
