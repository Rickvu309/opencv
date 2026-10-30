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

### Git

Tool: `scripts/ocv-tools.mjs`. `help` lists every job and flag; `doctor` checks this machine. Full notes: `CONTRIBUTING.md` and `docs/git-workflow/`. The rule table is generated: `scripts/ocv-tools.mjs rules --list` prints it, `docs/git-workflow/rule-enforcement.md` and `delivery-rules.md` hold it with the fix for each. Never bypass hooks.

Jobs:

- Issues: `file` writes an issue, `status <n>` shows where it stands, `board` lists all open issues, `approve <n>` relays an admin's `/approve` on a `risk:high` issue.
- Work: `take <n | title>` makes the worktree and records your claim, `save -m` commits and pushes, `release` gives the issue back, `shot` posts pictures.
- Deliver: `check` runs the quick check, `finish --body-file <file> [--draft]` opens the PR, `merge <pr#>` enqueues it once `ci` is green. `scripts/open-pr.sh` and `scripts/merge-pr.sh` still work.
- After the merge: `cleanup [<n> | --all]` removes the worktree and branch.
- Other: `doctor`, `rules`, `help`.

| #   | Rule                                                                                                                               | What makes it fail                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Every task has an issue; use `take`. Skip one assigned, held or `ready-for-human`.                                                 | `take` (ASSIGNED, HELD, READY_FOR_HUMAN)            |
| 1   | Split long work into sub-issues.                                                                                                   | Nothing                                             |
| 2   | Work only in your own worktree and port; the main checkout stays clean on `main`.                                                  | `take`, `merge` (MAIN_CLEAN, PORT)                  |
| 2   | Never touch another agent's worktree.                                                                                              | Nothing                                             |
| 3   | Branch `type/<issue#>-short-description` from `origin/main`.                                                                       | `pre-push`, `finish` (BAD_BRANCH)                   |
| 4   | PR title `type: description (#n)`; body has Summary, Evidence, Merge Danger, `Closes #n`.                                          | `finish` (BAD_TITLE, BAD_BODY)                      |
| 4   | `check`, then `finish`. A draft stays a draft until `gh pr ready`.                                                                 | `finish` (CHECK_REQUIRED), `merge` (DRAFT)          |
| 4   | Verify by hand (`.claude/skills/verify-opencv`) before ready.                                                                      | Nothing                                             |
| 5   | Never push or commit on `main`, use `--no-verify`, or commit `.env`.                                                               | Hooks, ruleset on `main`                            |
| 5   | `SKIP_CHECKS=1` only for a human-declared emergency, named in the PR.                                                              | `pre-push` (SKIP_DECLARED, SKIP_SAID)               |
| 5   | Gate files (`ci.yml`, `.github/actions/**`, `scripts/check.mjs`, ruleset) need `risk:high`; `risk:high` needs an admin `/approve`. | `merge` (RISK_HIGH_FOR_CI), `take` (NEEDS_APPROVAL) |
| 5   | Big decisions and mass deletions carry `needs-human-review`; an agent never merges it.                                             | `merge` (NEEDS_HUMAN_REVIEW, MASS_DELETE)           |
| 5   | Never approve your own PR or use another identity.                                                                                 | Nothing                                             |
| 6   | Merge only on green `ci` with `merge <pr#>` from the main checkout. No `--admin`.                                                  | `merge` (CI_REQUIRED), ruleset                      |
| 6   | After the merge run `cleanup <n>`.                                                                                                 | Nothing                                             |

Rebase when the branch does not merge cleanly: `git fetch origin && git rebase origin/main && git push --force-with-lease` (your own task branch only). If production is broken: open an issue, `take` it as `hotfix`, fix, `check`, `finish`, `merge`; if the fix is risky, tell a human to roll back the previous deploy first.

### Production recovery

Production sign-in recovery needs checks beyond a local OTP or HTTP 200. See `docs/agents/production-recovery.md` and `scripts/verify-auth-production.mjs`.

### Design system

Stock shadcn/ui on `base-nova` (Base UI) in `packages/ui`, consumed as source by `apps/web`. `docs/adr/0006-design-system-values-and-the-kit-as-generator.md` carries the design-system rule. Import through `@workspace/ui/components/<name>` and `@workspace/ui/globals.css`, and prefer kit components over raw `<button>`/`<input>`/`<textarea>`/`<select>`. Sources in order: shadcn/ui, AI Elements patterns copied into `apps/web/src/components/ai-elements/`, Kibo UI for large app pieces, then Cult UI, Magic UI and free affectUI items for showpieces. App code uses shadcn's own CSS variables only (`--background`, `--primary`, `--muted-foreground`, `--chart-1..5`, `--sidebar-*` and so on) and stock Tailwind sizes, with no raw hex or named palette classes (`bg-red-500`) outside the CV print paper. Motion has two token pairs, `--duration-micro` 150 ms with `--ease-micro` and `--duration-panel` 280 ms with `--ease-panel`, defined once in `globals.css`. `apps/web/src/test/design-vocabulary.test.ts` and `ui-kit-contract.test.ts` enforce all of it, and `pnpm --filter web test` fails on a violation.

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
