## Agent skills

### Issue tracker

Issues live in GitHub issues of `quanvu309/opencv`, created from the Task form in `.github/ISSUE_TEMPLATE/task.yml`. See `docs/agents/issue-tracker.md`.

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

### Git

These rules are not optional.
Full details: `CONTRIBUTING.md` and `docs/git-workflow/`. Rules and their checks: `docs/git-workflow/rule-enforcement.md`.

`.github/workflows/ci.yml` runs the quick check on the free runner `opencv-local` (required `ci` status). Never bypass the local hooks (`.githooks/`) or the review checklist.

#### 1. Issue first

- Never start work without a GitHub issue.
- If no issue exists, create one with `gh issue create` (or the Task form), or let `scripts/new-task.sh <type> "Issue title"` create it.
- If the issue is assigned to someone else, or a branch for it exists, stop and pick another issue.
- If the work will take more than a few days, split it into sub-issues and do one at a time.

#### 2. Always work in your own worktree

- Never edit files in the main checkout. It stays on `main` and is only used to fetch, create worktrees, and review.
- Start every task with:
  ```bash
  scripts/new-task.sh <type> <issue#> -d "short description"
  scripts/new-task.sh <type> "Issue title"          # creates the issue first
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

- The pre-push hook runs the quick check, `scripts/check.sh --changed`. The full lint, typecheck and test run once per PR, in `scripts/review-pr.sh`.
- For a PR that touches `apps/web/`, `apps/api/`, `packages/ui/`, `packages/domain/` or a verify skill, `scripts/review-pr.sh` also runs `verify:app-ui` and `verify:landing` at `VERIFY_TIER=invariant`. The allowed FAILs are each skill's `known-findings.json` on `main` minus the entries the PR deletes, so a fix PR deletes its entry. A NEW FAIL is rerun once, cold, and counts only when it fails in both runs. Check 34 (render timing) is advisory. A new FAIL, a fixed finding still listed, a STALE or a checker error fails the review. To add a known finding, open an issue first, then land the entry in its own PR that changes only `known-findings.json` files; the tier runs for it, so an entry whose check passes fails. A PR that adds an entry and changes anything else fails.
- Open the PR with `heavy -- scripts/open-pr.sh --draft`. It validates the branch, runs the quick check, pushes, and creates the PR with the title `type: description (#<issue>)` and `Closes #<issue>` in the body.
- Before marking ready (`gh pr ready`), the quick check passes and the verify-opencv evidence (`.claude/skills/verify-opencv`) is attached to the PR. There are no preview deploys yet.
- Heavy commands run through `heavy`: the full `scripts/check.sh`, `scripts/review-pr.sh`, and `scripts/open-pr.sh` or any push that triggers the pre-push hook, for example `heavy --label review-123 -- scripts/review-pr.sh 123`. It admits two jobs at a time, caps each at 4 cores and 4 GB, and exports `CHECK_CONCURRENCY=2` and `VITEST_MAX_WORKERS=2`. The PR scripts refuse to run without it. Never run two of your own at once. `heavy status` shows who holds the slots.
- A branch behind `main` needs no rebase: `scripts/review-pr.sh` tests the merge of `main` and the PR, which is what the squash merge lands. Rebase only when the review reports a merge conflict: `git fetch origin && git rebase origin/main && heavy -- git push --force-with-lease`.
  Force-push only ever goes to your own task branch.

#### 5. Never

- Never push to `main`, commit on `main`, or merge into `main` locally.
- Never use `git push --no-verify` or `git commit --no-verify`.
- Never use `SKIP_CHECKS=1` unless a human declared a production emergency, and then say so in the PR.
- Never approve your own PR, and never use the review agent's identity to approve your own work.
- Never remove the `needs-human-review` label or edit `.github/CODEOWNERS` to get around a human review.
- Human review is only for super important changes: a mass deletion (`review-pr.sh` flags a PR that deletes 25% or more of the files on `main` or 80% or more of one app or package; a rename counts as a deletion) or a big decision, which you flag with the `needs-human-review` label (for example dropping a product, a data-losing migration, changing pricing or the legal entity). Everything else merges without a human.
- Never commit `.env` or real secrets.
- Never pick up an issue labeled `ready-for-human`; it is a decision for a human.
- Never create `develop`, `staging`, or `release/` branches.
- Never add a workflow besides `ci.yml` or use a hosted runner (no budget). `ci.yml` changes are `risk:high`.

#### 6. Merge and clean up

- Merge only with squash. An agent under the owner's account (`@quanvu309`) merges its own PR with `heavy -- scripts/merge-pr.sh <pr#>` from the main checkout, never by hand. It refuses another author's PR, reruns `scripts/review-pr.sh`, and requires a comment or review that names the current patch id and says `Independent review` (plus `verify` when the PR changes `apps/`): `review-pr.sh: OK (patch id <id>, main <sha>). Independent review: <who>, approved. verify-<skill>: <result>`. Then it posts the `gates/review-pr` status and runs `gh pr merge --squash --match-head-commit <head>`. `--dry-run` stops before those two.
- No `--admin`, no bypass. GitHub requires `ci`, no approving review (one account). The independent review stays a local gate with no open finding; `HUMAN REQUIRED` is never merged.
- After merge, the issue closes and the remote branch is deleted automatically.
- From the main checkout: `scripts/cleanup-worktree.sh <issue#>`.

#### 7. Production is broken

- Open an issue, run `scripts/new-task.sh hotfix <issue#> -d "..."`, fix, run `heavy -- scripts/open-pr.sh`, and ask for immediate review.
- If the fix is risky, tell a human to roll back to the previous production deploy on the hosting platform first.

#### Review agent checklist

For the agent that reviews PRs. Run from the main checkout, for every PR marked ready (hotfixes immediately):

1. `heavy -- scripts/review-pr.sh <pr#>`. It checks the branch name, title, `Closes #`, issue, label, mass deletion, committed env files and `main` freshness, then runs the full `scripts/check.sh` once, in a throwaway worktree of the PR.
2. Result `HUMAN REQUIRED` (exit 2): the PR has `needs-human-review` or is a mass deletion. **Do not merge.** Comment your findings and leave it to a human.
3. Result `FAIL` (exit 1), including a committed real `.env` file or a requested-changes review: `gh pr review <pr#> --comment --body "FAIL: <what to fix>"`. Don't merge.
4. Result `OK` (exit 0): check the verify-opencv evidence for the changed flow, then read the diff (scope, tests, no secrets; look closely at `package.json` scripts, `scripts/`, `.githooks/`, `.github/`).
5. All good: post the evidence comment (format in section 6), then `heavy -- scripts/merge-pr.sh <pr#>`. Otherwise comment what to fix. (One account: GitHub won't take an approval or "request changes" from the PR author.)

Full checklist: `docs/git-workflow/review-and-approval.md`.

### Production recovery

Production sign-in recovery needs checks beyond a local OTP or HTTP 200. See `docs/agents/production-recovery.md` and `scripts/verify-auth-production.mjs`.

### Design system

Stock shadcn/ui on `base-nova` (Base UI) in `packages/ui`, consumed as source by `apps/web`. `docs/adr/0006-design-system-values-and-the-kit-as-generator.md` carries the design-system rule. Import through `@workspace/ui/components/<name>` and `@workspace/ui/globals.css`, and prefer kit components over raw `<button>`/`<input>`/`<textarea>`/`<select>`. Sources in order: shadcn/ui, AI Elements patterns copied into `apps/web/src/components/ai-elements/`, Kibo UI for heavy app pieces, then Cult UI, Magic UI and free affectUI items for showpieces. App code uses shadcn's own CSS variables only (`--background`, `--primary`, `--muted-foreground`, `--chart-1..5`, `--sidebar-*` and so on) and stock Tailwind sizes, with no raw hex or named palette classes (`bg-red-500`) outside the CV print paper. Motion has two token pairs, `--duration-micro` 150 ms with `--ease-micro` and `--duration-panel` 280 ms with `--ease-panel`, defined once in `globals.css`. `apps/web/src/test/design-vocabulary.test.ts` and `ui-kit-contract.test.ts` enforce all of it, and `pnpm --filter web test` fails on a violation.

Install: `pnpm dlx shadcn@latest add <name> -c apps/web` for shadcn, `pnpm dlx shadcn@latest add https://www.kibo-ui.com/r/<name>.json -c apps/web` for Kibo UI, `https://www.cult-ui.com/r/<name>.json` for Cult UI, `@magicui/<name>` for Magic UI and `https://www.affectui.com/r/<name>.json` for affectUI. After every install run `node scripts/ds-codemod.mjs` to rename retired class names. Never add a token; if a registry piece brings one, map it to a shadcn variable.

Design parity. The landing's design source is the pen frame named in `apps/web/src/features/landing/design/landing.snapshot.json`. The sign-in screen's is the frame in `apps/web/src/features/auth/design/auth.snapshot.json`. Regenerate a snapshot with `node scripts/pen-snapshot.mjs <pen> <frame id> <out.json>` when the design changes. The auth frame also copies its shader: `node scripts/pen-snapshot.mjs <pen> x1ht5a apps/web/src/features/auth/design/auth.snapshot.json --assets apps/web/src/features/auth/design`. Never build from `design/exports` PNGs. Every first-release frame (listed in `apps/web/src/test/design-frames.json`, regenerated with `node scripts/pen-release-frames.mjs <pen> apps/web/src/test/design-frames.json`) needs a committed snapshot that a test reads, or an entry in `PENDING_FRAMES` with its issue and expiry. A behavior test in the same folder does not count as design coverage. Apply's frames (W9.1 to W10.7) live in `apps/web/src/features/apply/design`; after an Apply change run `PORT=4454 heavy -- pnpm --filter web verify:apply-pen` (`.claude/skills/verify-app-ui/apply-pen.md`). For pricing or blog cover changes, run `node scripts/verify-marketing-design.mjs <local web origin> <evidence directory>` against your assigned worktree port. It visits pricing and every post at desktop and phone widths and saves screenshots. Inspect those images; visible labels cannot establish visual quality by themselves.

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
