## Agent skills

### Issue tracker

Issues live in GitHub issues of `Rickvu309/opencv`, created from the Task form in `.github/ISSUE_TEMPLATE/task.yml`. See `docs/agents/issue-tracker.md`.

### Triage labels

Only `ready-for-human` is a label; the other triage roles are read from the issue and its PRs. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` and `docs/adr/`). See `docs/agents/domain.md`.

### Code map

- `packages/domain/src` is pure TypeScript and zod, with no database, server or AI SDK import. It holds the typed contract.
  - `<surface>-contract.ts` declares each surface's commands and most of its reads (`paper`, `job`, `inbox`, `account`, and `chat` for commands).
  - `contract-commands.ts` joins every command into one table. `queries.ts` joins every read and declares the chat reads, `link.get` and `workspace.search`.
  - `chat-turn.ts` holds `ChatTurnEvent`, the Coach stream events.
  - `job-posting.ts` holds the posting link guard (`openableApplyJobUrl`) and the board stage enum, `job-position.ts` the board order keys.
- `apps/api/src/<module>/` is one product module: `account`, `chat`, `paper`, `job` and `inbox`. Other modules import it only through its `index.ts`.
  - `commands.ts` binds the module's contract commands with `bindCommands` and its reads with `tableQuery`. `account` binds its reads in `queries.ts`.
  - `job` also holds the posting fetch (`fetch-posting.ts`, the internal-host guard) and reads a posting into fields in `store.ts` (`fetchPosting`, `parsePostingText`), with the Coach's `interpretPosting` when `interpretPostings` is on.
  - `http.ts` mounts its routes. `store.ts` holds most of its writes. Only files under the module's directory write its tables, plus `auth.ts` for the auth tables (owner list: `registry/ownership.test.ts`).
- Other api folders:
  - `registry/` runs every command, writes the `activity`, `pending_actions` and idempotency rows, and builds the Coach's tools.
  - `coach/` runs a Coach turn and is the only importer of the AI SDK. It has no contract commands. See `docs/coach.md`.
  - `mail/` sends sign-in codes. `db/schema.ts` is the schema.
- `apps/web/src` is the SPA. `routes/` holds pages, `features/<surface>/` each surface's code and tests, `components/` and `lib/` what features share. Only `lib/` calls the api.
  - `contract-client.ts` runs commands and owns read keys and refresh.
  - `api.ts` (`apiFetch`) and `requests.ts` (`endpoints`) fetch reads. `coach-stream.ts` reads the Coach stream.
  - `features/<surface>/*-api.ts` wraps a surface's api calls over `lib/`.
- `packages/ui/src/components` is the shadcn kit. See Design system below.

To add a product action, follow `docs/adr/0010-one-typed-contract-for-commands-and-reads.md`:

1. Add a command entry to `packages/domain/src/<surface>-contract.ts`, with `invalidates` naming the reads it makes stale.
2. Bind it in `apps/api/src/<surface>/commands.ts` with its handler, reversal and activity line. A missing binding is a type error.
3. Add a case to `apps/api/src/registry/coverage-<surface>.ts` (`arrange`, `act`, `assert`, optional `undoAssert`). `coverage.test.ts` fails on a command with no case.
4. Call it from the web with `runContractCommand` from `apps/web/src/lib/contract-client.ts`. The Coach tool, step label, Undo and screen refresh follow from the entry.

Tests that hold this shape:

- `apps/api/src/registry/boundaries.test.ts` rejects an import into another api module that skips its `index.ts`.
- `apps/api/src/registry/ownership.test.ts` rejects a table write from outside the owning module's directory.
- `apps/api/src/registry/names.test.ts` rejects a command, read or Coach tool name in the web, fake Coach or domain that the registry lacks.
- `apps/api/src/**/*-contract.test.ts` and `apps/api/src/registry/contract.type-test.ts` reject a binding that drifts from the contract.
- `apps/web/src/test/request-boundary.test.ts` rejects an API path, `fetch` or query invalidation outside `apps/web/src/lib`.
- `apps/web/src/test/feature-imports.test.ts` rejects an import between `apps/web/src/features` folders that its `FEATURE_IMPORTS` table does not list, a folder with no row, a row for a gone folder, and an edge no import uses.
- `apps/web/src/test/design-vocabulary.test.ts` and `ui-kit-contract.test.ts` enforce the design system.
- `scripts/adr-citations.test.mjs` rejects a citation of an ADR number or path with no file in `docs/adr`. It cannot tell when an old number now names a different decision.
- `scripts/doc-paths.test.mjs` rejects a backticked repo path in AGENTS.md, CONTEXT.md, `docs/` or `.claude/skills/` that does not exist, with file and line.
- `scripts/retired-words.test.mjs` rejects Thread or Opportunity in source or file names under `apps/*/src` and `packages/*/src` outside its allowed list (Inbox mail threads and a few exceptions); say Chat or Job. The old Apply stage ids are unguarded until #437.
- `scripts/unused-domain-exports.test.mjs` rejects an export of `packages/domain/src` that no other non-test file imports; drop `export` or delete it. `KEPT_ON_PURPOSE` lists the exceptions.
- `scripts/no-comments.test.mjs` rejects any new comment in source, CSS included. Explain with a better name or a test. `scripts/no-comments.baseline.json` lists the old ones and only shrinks; lower it with `node scripts/no-comments.mjs --write-baseline`.
- `scripts/web-test-clock.test.mjs` rejects a web test setup that does not pin the clock. `apps/web/src/test/setup.ts` calls `pinTestClock` before every test, so fixtures anchor to `TEST_NOW` in `apps/web/src/test/test-clock.ts` and never to the real date.

### Git

These rules are not optional.
Full details: `CONTRIBUTING.md` and `docs/git-workflow/`. Rules and their checks: `docs/git-workflow/rule-enforcement.md`.

`ci.yml` runs affected jobs for PRs and full jobs for merge groups. Aggregate `ci` requires every job to succeed. Never bypass hooks. Wait for green `ci` before `scripts/ocv-tools.mjs merge`.

#### 1. Issue first

- Never start work without a GitHub issue.
- If no issue exists, create one with `gh issue create` (or the Task form), or let `scripts/ocv-tools.mjs take "Issue title"` create it.
- If the issue is assigned to someone else, or a branch for it exists, stop and pick another issue.
- If the work will take more than a few days, split it into sub-issues and do one at a time.

#### 2. Always work in your own worktree

- Never edit files in the main checkout. It stays on `main` and is only used to fetch, create worktrees, and merge.
- Start every task with:
  ```bash
  scripts/ocv-tools.mjs take <issue#> -d "short description"
  scripts/ocv-tools.mjs take "Issue title"          # creates the issue first
  ```
  It also turns on the local hooks (`git config core.hooksPath .githooks`).
- Work only inside the printed worktree path (`../opencv.worktrees/<issue#>-short-description`).
- Use only your assigned port (printed by the script, stored as `PORT` in the worktree's `.env`).
- One agent, one issue, one branch, one worktree. Never touch another agent's worktree.

#### 3. Branch naming

- Format: `type/<issue#>-short-description`, e.g. `feat/42-login-page`.
- Types: `feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`.
- Lowercase kebab-case, 3-5 words, branched from the latest `origin/main`. The pre-push hook rejects other names.

#### 4. Checks, commits, and PRs

- The git hooks run the one rule table (`scripts/ocv-tools/rules`). At commit: format, file size and attribution. At push: no push to main, branch name, then `pnpm check` (affected tasks, guards and formatting). CI runs affected lint, types, build, tests and guards, plus the `policy` job.
- Run `scripts/ocv-tools.mjs finish --body-file <file>` (add `--draft` to open a draft). Use the `pr` skill (Summary, Evidence, Merge Danger). Finish runs the pull request rules early, pushes through the hooks, and opens `type: description (#<issue>)` with `Closes #<issue>`.
- A draft is optional. Mark a draft ready with `gh pr ready` once the evidence is attached. Run verify skills by hand (`.claude/skills/verify-opencv`). No preview deploys.
- CI is hosted. Run local checks serially. `scripts/check.mjs` sets `CHECK_CONCURRENCY` and `VITEST_MAX_WORKERS` to 2.
- Rebase when the branch does not merge cleanly with `main`: `git fetch origin && git rebase origin/main && git push --force-with-lease`.
  Force-push only ever goes to your own task branch.

#### 5. Never

- Never push to `main`, commit on `main`, or merge into `main` locally.
- Never use `git push --no-verify` or `git commit --no-verify`.
- Never use `SKIP_CHECKS=1` unless a human declared a production emergency, and then say so in the PR.
- Never approve your own PR, and never use the review agent's identity to approve your own work.
- Never remove the `needs-human-review` label or edit `.github/CODEOWNERS` to get around a human review.
- Human review is only for a big decision. Flag it with the `needs-human-review` label (for example dropping a product, a data-losing migration, changing pricing or the legal entity). An agent never merges a PR with that label. A mass deletion is not stopped by a script; add the label yourself.
- Never commit `.env` or real secrets.
- Never pick up an issue labeled `ready-for-human`; it is a decision for a human.
- Never create `develop`, `staging`, or `release/` branches.
- CI runs on GitHub-hosted runners; a rule refuses any workflow file besides `ci.yml` and `nightly.yml` and allows setup actions. Workflow and action changes need `risk:high`.

#### 6. Merge and clean up

- From the main checkout, run `scripts/ocv-tools.mjs merge <pr#>` after green `ci`. It refuses drafts, another author, `needs-human-review`, a mass deletion (over 25 authored files, 2000 lines or 10% of authored files; add `needs-human-review`), a wrong title, missing `Closes #n` or a closed issue, ci without success on the head, and gate changes without `risk:high` (`ci.yml`, `nightly.yml`, `.github/actions/**`, `scripts/check.mjs`, `.github/rulesets/main.json`). It enqueues with `--match-head-commit`; the queue runs full `ci` before squash-merging.
- No `--admin`, no bypass. GitHub requires `ci` and no approval.
- After the queue accepts the PR, run `scripts/ocv-tools.mjs merge <pr#> --wait` as a background command (`run_in_background`) and end the turn. It exits when the PR merges (and closes the linked issues), when the PR leaves the queue, or after 45 minutes. A PR watcher does not wake you for a queue merge, so a turn that ends without this background job is stuck. When it exits, the worktree and branches are already removed; run `scripts/ocv-tools.mjs cleanup <issue#>` from the main checkout only when it says cleanup needs a hand.

#### 7. Production is broken

- Open an issue, run `scripts/ocv-tools.mjs take <issue#> -d "..."` (type hotfix), fix, run `scripts/ocv-tools.mjs finish --body-file <file>`, and merge with `scripts/ocv-tools.mjs merge` once `ci` is green.
- If the fix is risky, tell a human to roll back to the previous production deploy on the hosting platform first.

#### Review agent checklist

Open the PR, wait for green `ci`, then `scripts/ocv-tools.mjs merge <pr#>`. One account, so no approval. A PR with `needs-human-review` is never merged by an agent.

Full notes: `docs/git-workflow/review-and-approval.md`.

### Production recovery

Production sign-in recovery needs checks beyond a local OTP or HTTP 200. See `docs/agents/production-recovery.md` and `scripts/verify-auth-production.mjs`.

### Design system

Stock shadcn/ui on `base-nova` (Base UI) in `packages/ui`, consumed as source by `apps/web`. `docs/adr/0006-design-system-values-and-the-kit-as-generator.md` carries the design-system rule. Import through `@workspace/ui/components/<name>` and `@workspace/ui/globals.css`, and prefer kit components over raw `<button>`/`<input>`/`<textarea>`/`<select>`. Sources in order: shadcn/ui, AI Elements patterns copied into `apps/web/src/components/ai-elements/`, Kibo UI for large app pieces, then Cult UI, Magic UI and free affectUI items for showpieces. App code uses shadcn's own CSS variables only (`--background`, `--primary`, `--muted-foreground`, `--chart-1..5`, `--sidebar-*` and so on) and stock Tailwind sizes, with no raw hex or named palette classes (`bg-red-500`) outside the CV print paper. User-approved exception: pen-backed screens may use exact reference typography, spacing, dimensions and colors while retaining Inter and shared shadcn components. Keep exact colors in feature-local design/*.pen.css, scope every selector with that feature's data-pen-surface attribute, and use only hex colors present in adjacent *.styles.json source snapshots. Exact sizes may use Tailwind arbitrary values. This exception adds no global design tokens and does not permit named palette classes or unrelated styling changes. Motion has two token pairs, `--duration-micro` 150 ms with `--ease-micro` and `--duration-panel` 280 ms with `--ease-panel`, defined once in `globals.css`. `apps/web/src/test/design-vocabulary.test.ts` and `ui-kit-contract.test.ts` enforce all of it, and `pnpm --filter web test` fails on a violation.

Install: `pnpm dlx shadcn@latest add <name> -c apps/web` for shadcn, `pnpm dlx shadcn@latest add https://www.kibo-ui.com/r/<name>.json -c apps/web` for Kibo UI, `https://www.cult-ui.com/r/<name>.json` for Cult UI, `@magicui/<name>` for Magic UI and `https://www.affectui.com/r/<name>.json` for affectUI. After every install run `node scripts/ds-codemod.mjs` to rename retired class names. Never add a token; if a registry piece brings one, map it to a shadcn variable.

Design parity. The landing's design source is the pen frame named in `apps/web/src/features/landing/design/landing.snapshot.json`. The sign-in screen's is the frame in `apps/web/src/features/auth/design/auth.snapshot.json`. Regenerate a snapshot with `node scripts/pen-snapshot.mjs <pen> <frame id> <out.json>` when the design changes. The auth frame also copies its shader: `node scripts/pen-snapshot.mjs <pen> x1ht5a apps/web/src/features/auth/design/auth.snapshot.json --assets apps/web/src/features/auth/design`. Never build from `design/exports` PNGs. Every first-release frame (listed in `apps/web/src/test/design-frames.json`, regenerated with `node scripts/pen-release-frames.mjs <pen> apps/web/src/test/design-frames.json`) needs a committed snapshot that a test reads, or an entry in `PENDING_FRAMES` with its issue and expiry. A behavior test in the same folder does not count as design coverage. Apply's frames (W9.1 to W10.7) live in `apps/web/src/features/apply/design`; after an Apply change run `PORT=4454 pnpm --filter web verify:apply-pen` (`.claude/skills/verify-app-ui/apply-pen.md`). For pricing or blog cover changes, run `node scripts/verify-marketing-design.mjs <local web origin> <evidence directory>` against your assigned worktree port. It visits pricing and every post at desktop and phone widths and saves screenshots. Inspect those images; visible labels cannot establish visual quality by themselves.

Signed-in screens match their pen frame in layout, not only in copy. A screen built from a frame gets an expected layout: `node scripts/pen-layout.mjs <pen> <frame id> apps/web/src/features/<feature>/design/<screen>.layout.json --route <path>` records every pen text's box, size, weight, tracking and colour. `PORT=4450 pnpm --filter web verify:pen-layout` loads each layout's route at 1440x900 and fails on any text more than 8px off or styled differently. Run it before marking a design PR ready and attach its output. Build each designed screen in its own component from its frame. Never pour a new frame into a shared page template that predates it.

Rules and what enforces them:

| Rule                                                                | Enforced by                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Landing text matches the pen frame                                  | `landing-design-parity.test.tsx`                                                                  |
| Landing text styles and marks match the frame                       | verify-landing 31                                                                                 |
| Auth screens match the pen auth layout                              | `auth-design-parity.test.tsx`                                                                     |
| Pen shader and image fills are built, not dropped                   | `scripts/pen-snapshot.mjs` fills and the parity tests                                             |
| Hidden pen nodes stay hidden                                        | `scripts/pen-snapshot.mjs` skips `enabled:false`                                                  |
| Landing art comes from pen geometry                                 | `scripts/pen-art-to-svg.mjs` and verify-landing 27                                                |
| Rotated pen ellipses pivot on the corner                            | `scripts/pen-art-to-svg.mjs` and verify-landing 30                                                |
| Nav lockup spacing matches the frame                                | verify-landing 28                                                                                 |
| Marketing calls to action                                           | `landing-button.ts`, `landing-button.test.ts` and verify-landing 29                               |
| Pricing uses its own pen frame and scale                            | `pricing-parity.test.tsx` and `scripts/verify-marketing-design.mjs`                               |
| Blog cover shows the article’s argument                             | Typed `blog-cover-stories.ts`, `blog-covers.test.tsx`, and `scripts/verify-marketing-design.mjs`  |
| Signed-in screen layout matches its pen frame                       | `scripts/pen-layout.mjs`, `*.layout.json` and `verify:pen-layout` (`pen-layout-compare.test.mjs`) |
| Verify skills name product routes without the retired `/app` prefix | `scripts/skill-routes.test.mjs`                                                                   |
| Apply shows every text and icon of its frames                       | `apply-design-parity.board.test.tsx`, `apply-design-parity.job.test.tsx`                          |
| Apply text styles and icon sizes match the frames                   | `verify-apply-pen.mjs` (`pnpm --filter web verify:apply-pen`)                                     |
| Stock tokens only                                                   | `design-vocabulary.test.ts`                                                                       |
| Release frames have parity snapshots                                | `design-frame-coverage.test.ts`                                                                   |
| Module boundaries                                                   | `boundaries.test.ts`                                                                              |
