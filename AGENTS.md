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

To add a product action, follow `docs/adr/0010-one-typed-contract-for-commands-and-reads.md`:

1. Add a command entry to `packages/domain/src/<surface>-contract.ts`, with `invalidates` naming the reads it makes stale.
2. Bind it in `apps/api/src/<surface>/commands.ts` with its handler, reversal and activity line.
3. Add a case to `apps/api/src/registry/coverage-<surface>.ts`.
4. Call it from the web with `runContractCommand` from `apps/web/src/lib/contract-client.ts`.

Tests that hold this shape:

- `apps/api/src/registry/names.test.ts` rejects a command, read or Coach tool name in the web, fake Coach or domain that the registry lacks.
- `apps/api/src/**/*-contract.test.ts` and `apps/api/src/registry/contract.type-test.ts` reject a binding that drifts from the contract.
- `warm-routes.test.ts`: preloads.
- `apps/web/src/test/feature-imports.test.ts` rejects an import between `apps/web/src/features` folders that its `FEATURE_IMPORTS` table does not list, a folder with no row, a row for a gone folder, and an edge no import uses.
- `scripts/retired-words.test.mjs` rejects Thread or Opportunity in source or file names under `apps/*/src` and `packages/*/src` outside its allowed list (Inbox mail threads); say Chat or Job.
- `apps/api/src/registry/coach-chat-tools.test.ts` bars chat.create.
- `scripts/no-comments.test.mjs` rejects any new comment in source, CSS included; use a better name or a test. `scripts/no-comments.baseline.json` only shrinks.
- Web test fixtures anchor to `TEST_NOW` in `apps/web/src/test/test-clock.ts`, never the real date (`scripts/web-test-clock.test.mjs`). A node test injects `timers` instead of waiting on the real clock (`packages/guards/wall-clock.test.mjs`).
- Start a browser only through `scripts/lib/chrome-process.mjs` (`scripts/browser-launcher.test.mjs`).
- `scripts/layout-comparison-gates.test.mjs` rejects a verify driver that calls `comparePenLayout` and never reads its `mismatches`. A `PENDING` entry (issue, expiry) lists an exception.
- `scripts/kit-duplicates.test.mjs` rejects `clipboard.writeText` or `execCommand("copy")` outside `packages/ui/src/components/copy-button.tsx`, `animate-spin` in `apps/*`, and a hand-built breadcrumb; use kit `CopyButton`, `Spinner` and `Breadcrumb`. A `pending` entry (PR, expiry) lists a caller being migrated.
- `scripts/focus-indication.test.mjs` rejects a `*.pen.css` rule that sets `box-shadow` or `outline` on a button, link or field with no `:focus-visible` rule; web lint rejects `hover:bg-transparent` and `focus-visible:ring-0` under `features/app-shell`.
- `scripts/touch-targets.test.mjs` rejects a Button or hover-styled class under `features/app-shell` with no 44px phone height (`h-11 md:h-7`).
- `apps/web/src/test/nav-contract.test.tsx` renders each router route under a nav item and rejects an item not current on it, or a count missing from its link name. `nav-pending.json` lists known offenders (PR, expiry); `scripts/nav-pending.test.mjs` fails a stale one.
- `scripts/paper-save-keeps-parts.test.mjs` rejects an autosave `toDocument` that returns the markdown alone, which would erase a letter's sender, date and closing. Its `PENDING` list works like the one above.
- `scripts/pointer-capture.test.mjs` rejects `setPointerCapture` in a module with no `pointercancel` and `lostpointercapture` handler.
- Web lint rejects `onMouseEnter`/`onPointerEnter` (use kit `Popover openOnHover` or `useHoverIntent`), `inert={...}` (use `FocusSafeRegion`), `style.setProperty("--x")` (set `width` or `transform`) and a `window`/`document` key listener (use `useShortcut`, `apps/web/src/lib/use-shortcut.ts`, which ignores typing, held keys and a pointer drag).
- `apps/web/src/test/disclosure-buttons.test.ts` rejects `aria-controls` without `aria-expanded`, and an app-shell dock button without both.

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
- Run the verify skills by hand (`.claude/skills/verify-opencv`) and attach the evidence, then mark a draft ready with `gh pr ready`. No preview deploys exist.
- Run local checks serially; `scripts/check.mjs` caps workers at 2.
- Rebase onto `origin/main` when the branch does not merge cleanly, and `git push --force-with-lease` to your own task branch only.

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

- Follow the same flow with a `hotfix` branch.
- If the fix is risky, tell a human to roll back to the previous production deploy on the hosting platform first.

Review notes: `docs/git-workflow/review-and-approval.md`.

### Production recovery

Production sign-in recovery needs checks beyond a local OTP or HTTP 200. See `docs/agents/production-recovery.md` and `scripts/verify-auth-production.mjs`.

### Design system

Stock shadcn/ui on `base-nova` (Base UI) in `packages/ui`. `docs/adr/0006-design-system-values-and-the-kit-as-generator.md` carries the design-system rule. Import through `@workspace/ui/components/<name>` and `@workspace/ui/globals.css`, and prefer kit components over raw `<button>`/`<input>`/`<textarea>`/`<select>`. Sources in order: shadcn/ui, AI Elements patterns copied into `apps/web/src/components/ai-elements/`, Kibo UI for large app pieces, then Cult UI, Magic UI and free affectUI items for showpieces. App code uses shadcn's own CSS variables only (`--background`, `--primary`, `--sidebar-*` and so on) and stock Tailwind sizes, with no raw hex or named palette classes (`bg-red-500`) outside the CV print paper. User-approved exception: pen-backed screens may use exact reference typography, spacing, dimensions and colors while retaining Inter and shared shadcn components. Keep exact colors in feature-local design/*.pen.css, scope every selector with that feature's data-pen-surface attribute, and use only hex colors present in adjacent *.styles.json source snapshots. Exact sizes may use arbitrary values. Motion uses the two token pairs in `globals.css`, `--duration-micro` with `--ease-micro` and `--duration-panel` with `--ease-panel`. `design-vocabulary.test.ts` and `ui-kit-contract.test.ts` in `apps/web/src/test` enforce all of it.

Install commands are in `docs/agents/design-parity.md`. After every install run `node scripts/ds-codemod.mjs`, and map any registry token to a shadcn variable.

Design parity. The landing's design source is the pen frame named in `apps/web/src/features/landing/design/landing.snapshot.json`, the sign-in screen's the frame in `apps/web/src/features/auth/design/auth.snapshot.json`. Regenerate it with `docs/agents/design-parity.md`. Build from the pen snapshots, not `design/exports` PNGs. Every first-release frame (listed in `apps/web/src/test/design-frames.json`) needs a committed snapshot that a test reads, or an entry in `PENDING_FRAMES` with its issue and expiry. Apply's frames (W9.1 to W10.7) live in `apps/web/src/features/apply/design`; after an Apply change run `PORT=4454 pnpm --filter web verify:apply-pen` (`.claude/skills/verify-app-ui/apply-pen.md`). For pricing or blog cover changes, run `node scripts/verify-marketing-design.mjs <local web origin> <evidence directory>` against your worktree port, then inspect the screenshots.

Signed-in screens match their pen frame in layout, not only in copy. A screen built from a frame gets an expected layout (`<screen>.layout.json`, recorded as in `docs/agents/design-parity.md`). Run `PORT=4450 pnpm --filter web verify:pen-layout` before marking a design PR ready and attach its output. Build each designed screen in its own component from its frame, not in a shared page template that predates it.

Rules and what enforces them:

| Rule                                                                | Enforced by                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Landing text matches the pen frame                                  | `landing-design-parity.test.tsx`                                                                 |
| Landing text styles and marks match the frame                       | verify-landing 31                                                                                |
| Auth screens match the pen auth layout                              | `auth-design-parity.test.tsx`                                                                    |
| Pen shader and image fills are built, not dropped                   | `scripts/pen-snapshot.mjs` fills and the parity tests                                            |
| Hidden pen nodes stay hidden                                        | `scripts/pen-snapshot.mjs` skips `enabled:false`                                                 |
| Landing art comes from pen geometry                                 | `scripts/pen-art-to-svg.mjs` and verify-landing 27                                               |
| Rotated pen ellipses pivot on the corner                            | `scripts/pen-art-to-svg.mjs` and verify-landing 30                                               |
| Nav lockup spacing matches the frame                                | verify-landing 28                                                                                |
| Marketing calls to action                                           | `landing-button.ts`, `landing-button.test.ts` and verify-landing 29                              |
| Pricing uses its own pen frame and scale                            | `pricing-parity.test.tsx` and `scripts/verify-marketing-design.mjs`                              |
| Blog cover shows the article’s argument                             | Typed `blog-cover-stories.ts`, `blog-covers.test.tsx`, and `scripts/verify-marketing-design.mjs` |
| Verify skills name product routes without the retired `/app` prefix | `scripts/skill-routes.test.mjs`                                                                  |
| Apply shows every text and icon of its frames                       | `apply-design-parity.board.test.tsx`, `apply-design-parity.job.test.tsx`                         |
