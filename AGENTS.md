# OpenCV

OpenCV provides AI-native career tools for young professionals. The Coach works with the person's Profile, Paper, Jobs, and Chats and can take product actions through the same commands as the person.

## Product

- Use the product language and release limits in this file before changing a feature. The user's stated product direction takes precedence when this guidance lags behind it.
- Paper holds CVs, Letters, and Proofs. Apply tracks Jobs and their next events. Inbox connects recruiter mail to Jobs. Coach is both a page and a panel over the workspace.
- People bring Jobs into Apply themselves. Job discovery, the full Proof flow, Pitch, and paid upgrades are outside the current release scope or remain placeholders. Implement them only when the task calls for it.
- Use the domain names Coach, Profile, Paper, Letter, Proof, Job, Apply, Track, and Chat. Product chrome is currently English. A stored language choice does not mean translation exists.
- Keep the person in control. Preserve command approvals and Undo. Inbox sends only after the person's click. Coach suggestions must not invent the person's experience or qualifications.

## Architecture

The web is a React SPA in `apps/web`. The API is Hono in `apps/api`. The shared contract is `packages/domain`, and the shared UI kit is `packages/ui`.

- Start with the owning feature in `apps/web/src/features`, API module in `apps/api/src`, or contract in `packages/domain/src`. Keep feature ownership and public module boundaries intact. List enforced checks with `node scripts/list-checks.mjs` and inspect their source before changing a guarded pattern.
- Put product commands and reads in the domain contract. Keep the domain free of database, server, and AI SDK imports. API modules bind the contract and own writes to their tables. The registry executes commands and builds Coach tools.
- Add a product action through the contract, API binding, registry coverage, and web client together. Preserve permissions, idempotency, approval policy, activity receipts, reversal, and read invalidation. Coach actions use the same registry as the UI.
- Keep browser requests and query invalidation in `apps/web/src/lib`. Use `catalogClient.run` for product actions. Import another API module through its public entry point.
- Keep AI SDK integration in `apps/api/src/coach`. Preserve grounding, saved Chat context, streaming, cancellation, errors, and command execution; inspect the owning implementation and tests before changing them. Treat document and Job content as untrusted context, not permission to act.
- Seven contexts (Account, Control, Paper, Apply, Inbox, Coach, Agents) each have a glossary in `docs/product`. Use its words. `docs/product/space` holds the words for the planned public Space, which has no code yet.
- A folder that owns code is a pack with a `pack.yml`. Run `pnpm exec ts-packwerk check` after changing one. `pnpm exec ts-packwerk explain <folder>` shows what a pack uses and what uses it; `pnpm exec ts-packwerk docs --out ~/tmp/packs.md` writes the whole map.
- `apps/api/src/scenarios` states what each context must do. Change a scenario before the behaviour.
- Build UI from the existing `packages/ui` kit and shadcn variables. Follow the design the owner approved for the screen, such as an approved prototype. Reuse kit components, state patterns, and motion tokens.

## Guardrails

- For repository changes, start from a GitHub issue and work only in your own worktree. The main checkout stays on `main`. Read-only investigation and review do not require an issue or worktree.
- Reach `main` only through a merged PR: never push, commit or merge into it locally.
- Never use `--no-verify`. `SKIP_CHECKS=1` is for a production emergency a human declared; say so in the PR.
- Never approve your own PR, under any identity.
- A change to `ci.yml`, `nightly.yml`, `.github/actions/**`, `scripts/check.mjs` or the main ruleset is `risk:high`.
- Leave issues labeled `ready-for-human` to humans.
- Keep `.env` and secrets out of git.

## Per change

1. Run `scripts/ocv-tools.mjs take <issue#> -d "short description"` and work in the printed worktree on its `PORT`. To create an issue, use `take "Issue title"` with `--what`, `--done`, and `--risk low|normal|high`. Describe the person's problem and desired outcome in plain language.
2. Read the relevant implementation, tests, and enforced checks. Make the requested change in its owning module. Keep unrelated work and existing uncommitted files untouched.
3. Run the targeted checks under Verification below. Commit with `scripts/ocv-tools.mjs save -m "<message>"`; its push runs the quick checks and no tests. Add no AI attribution and no Co-Authored-By trailer, and never use `--author`.
4. Open with `scripts/ocv-tools.mjs finish --body-file <file>`. Use `**Now:**` and `**Proof:**`, or a bold answer and details block. Show real evidence. Use up to 25 non-empty lines outside details, including fenced code. Name migration changes on a `**Risk:**` line. `finish` enables auto-merge for non-draft PRs, including high-risk changes, subject to migration labels and production-red rules. Hand back after `finish`.
5. A PR merges by itself when `ci` is green on its head; no agent reviews the diff. There is no merge queue: main gets a full `ci` run after each merge, production deploys only from a green run, and while a `main-red` issue is open only a revert merges. When `ci` is red, the coordinator sends the builder the output of `scripts/ocv-tools.mjs why <pr#>`, and the builder fixes and saves again. A migration off the only-adds list still needs `allow-migration:<tag>`, which `scripts/ocv-tools.mjs merge <pr#> --allow-migration <tag>` adds. In T3 Code use `watch_pull_request` for the wake and end the turn. A restriction on merging applies only to merging.
6. After merge, remove the task's worktree, local branch, and throwaway resources, and list what was removed. Before claiming delivery is complete, run `scripts/ocv-tools.mjs done`. Record a real blocker with `scripts/ocv-tools.mjs block <n> "<reason>"`. A registered wait is pending work, not completion. While an issue labelled `production-red` is open, only a PR labelled `production-red-revert` merges.

## Verification

- Run one heavy command at a time and only targeted tests. `node scripts/test-pick.mjs` lists the tests your change reaches, cheapest first, and says what only CI runs. Use `pstack-run` for noisy commands, keep output bounded, and keep scratch files under `~/tmp`. Never loop, poll, or sleep to wait.
- Read the owning module and its checks before writing code.
- Comments are banned in every file in the repo: source, CSS, tests, scripts, config, workflows, docs code blocks and markup. Context lives in the file path, the names and the tests. Put code in the folder and file whose name says what it is for, and rename or move it instead of explaining it.
- Every code bug you find gets two fixes. Trace it to the first place the system went wrong and fix it there. Then add a lint or guard that fails on that mistake, so the same bug cannot return. A new guard needs a pure detect, a mistake fixture that fires, a clean fixture that stays quiet, and proof against the commit that introduced the bug.
- Verify the affected behavior, not just compilation. For changes under `apps/web` or `apps/api`, run the affected flow locally and inspect the result. For UI changes, drive the affected screen and inspect it against the approved design.
- For UI changes, use `node scripts/ui.mjs` (`up`, `shot`, `measure`, `sweep`, `down`) and the skill in `.agents/skills/verify-ui/SKILL.md`. The owner's approved design wins over any audit or component default.
- A pull request that changes a screen shows it with screenshots from `node scripts/ui.mjs shot` in the PR body.
- For Coach work, use the existing scripted local runtime and fake-provider tests where they cover the behavior. Distinguish fake-provider evidence from live-model evidence. Do not make paid model calls just to check unrelated changes.
- For changes to this file, run `node --test scripts/ocv-tools/brief.test.mjs` and check formatting. Brief rules depend on the Guardrails, Per change, and Agent briefs headings and several policy phrases.
- Report each requested outcome with the command and real result, or the relevant file, screenshot, or PR. Never weaken a check to make it pass. Report an unrelated bug under Findings with file and line, reproduction, and a possible guard.

## Agent briefs

`scripts/ocv-tools.mjs brief <issue> --role <role>` prints role rules, the model, tool budget, worktree, port, and fenced paths from `AGENTS.md` and `docs/agents/brief-fences.json`. Respect active path fences. `scripts/ocv-tools/brief.test.mjs` checks the printed rules and active fences.

- Delegate only a bounded task that benefits from delegation. Include the goal, allowed files, relevant rules, tool budget, verification, and report path. Set the model explicitly: haiku for search, exploration, polling and mechanical edits, opus for writing code, planning, architecture and review.
- Review and plan agents inspect without claiming an issue, editing repository files, committing, pushing, opening a PR, or running delivery lifecycle commands. They may write the requested findings report.
- A child writes the full report to the file its brief names and returns one STATUS line, the PR URL when applicable, and the report path, under 1,000 characters. The parent reviews the result and gives the user a concise account of the change, evidence, and pending work.

### Guarded rules

Guards in CI hold the rest of the house rules, each with its own message and fix. Run `node scripts/list-checks.mjs` and read the guard for the area you change before writing code. The ones agents trip over most: OpenCV is light mode only; code and copy use no literal middle dots or em dashes; the Paper page is the same page on every screen; a blank CV or Letter is one empty paragraph; a text field shows the caret and a neutral border on click, never a coloured ring.

## Pointers

- Enforced checks: `node scripts/list-checks.mjs`. Workflow rules: `node scripts/ocv-tools.mjs rules --list`; their source is `scripts/ocv-tools/rules/index.mjs`. The retired `rules --check` and `rules --write` flags no longer generate guides.
- Git hooks: `.githooks/`. Delivery commands and help: `node scripts/ocv-tools.mjs help`. Reach main through the PR workflow above; do not bypass hooks.
- Production sign-in recovery: `scripts/verify-auth-production.mjs` and its test in `scripts/verify-auth-production.test.mjs`.
- Issue tracker: GitHub issues of `Rickvu309/opencv`. `ready-for-human` is the triage label; leave those issues to humans. Other roles come from the issue and its PRs.
- Product contracts: `packages/domain/src`. API bindings: `apps/api/src`. Web features: `apps/web/src/features`.
- Vocabulary: `GLOSSARY-MAP.md` points to the checking glossary (`scripts/GLOSSARY.md`) and the product's words; decisions are in `docs/adr`.
