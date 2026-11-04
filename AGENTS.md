# OpenCV

A job-search web app: a React SPA (`apps/web`) and a Hono api (`apps/api`) over one typed contract (`packages/domain`).

## Guardrails

- Start from a GitHub issue and work only in your own worktree; the main checkout stays on `main`.
- Reach `main` only through a merged PR: never push, commit or merge into it locally.
- Never use `--no-verify`. `SKIP_CHECKS=1` is for a production emergency a human declared; say so in the PR.
- Never approve your own PR, under any identity.
- Flag a big decision (dropping a product, a data-losing migration, pricing, the legal entity) or a mass deletion with `needs-human-review`; never merge a PR with it, remove it or edit `.github/CODEOWNERS` around it.
- A change to `ci.yml`, `nightly.yml`, `.github/actions/**`, `scripts/check.mjs` or the main ruleset is `risk:high` and needs the owner's `/approve`.
- Leave issues labeled `ready-for-human` to humans.
- Keep `.env` and secrets out of git.

## Per change

1. `scripts/ocv-tools.mjs take <issue#> -d "short description"` (or `take "Issue title"` to create the issue), then work in the printed worktree on its `PORT`.
2. `scripts/ocv-tools.mjs finish --body-file <file>` opens the PR (`pr` skill: Summary, Evidence, Merge Danger).
3. After green `ci`, from the main checkout: `scripts/ocv-tools.mjs merge <pr#>`, then `scripts/ocv-tools.mjs merge <pr#> --wait` as a background command (`run_in_background`) and end the turn.

## Agent briefs

`scripts/ocv-tools.mjs brief <issue> --role <role>` prints the brief rules from `docs/agents/brief-rules.md`; each rule cites a section here, and `scripts/ocv-tools/brief.test.mjs` fails when one stops matching.

- Finish the request in the turn. Continue all independent authorized work before yielding for an external dependency. A restriction on merging applies only to merging. Before you say you are done, run `scripts/ocv-tools.mjs done`; record a real blocker with `scripts/ocv-tools.mjs block <n> "<reason>"`. For a remaining check or review, use the host's watch and wake mechanism.
- Done means evidence: the command you ran and its real output, listed against each requested item.
- Commit with `scripts/ocv-tools.mjs save -m "<message>"`. Add no AI attribution and no Co-Authored-By trailer, and never use `--author`.
- Write no comments in any file, CSS and tests included. Explain with names or tests.
- A guard exports a pure detect, a mistake fixture that fires and a clean fixture that stays quiet, plus proof against a past commit.
- A real bug outside your scope goes in the report under Findings with file:line, a repro and the lint idea. Never weaken a check to make it pass.
- Run one heavy command at a time and only targeted tests; never loop, poll or sleep to wait. Keep output bounded. Scratch files go under the tmp folder in your home directory, never `/tmp`.
- Set the model on every subagent spawn: haiku for search, exploration, polling and mechanical edits, opus for writing code, planning, architecture and review.
- Write the full report to the file the brief names and reply with one STATUS line, the pull request URL and the report path.
- After a merge, remove the worktree, the local branch and any throwaway folder you made, and list what you removed.

### Completion rules

| Rule                                                                  | Enforcement                                                                                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recording a blocker never completes open work.                        | `done` exits 4 for blocked work, 1 if any unblocked item remains; `scripts/ocv-tools/done.test.mjs` replays the #1083 and #1084 handbacks.              |
| An empty ownership check does not prove the full request is complete. | `done` states its agent scope and requires checking the full request; the coordinator must match each requested item to evidence before final handback. |

## Pointers

- Code (writing or reviewing source, tests, UI, a guard): `CODING_STANDARDS.md`, with every guard listed by `node scripts/list-checks.mjs`.
- Layout (where a file or module lives): `docs/agents/code-map.md`.
- Contract (add or change a command, read or Coach tool): `docs/adr/0010-one-typed-contract-for-commands-and-reads.md`.
- Design (kit styling, registry install, pen frame or snapshot, signed-in screen layout, pricing or blog cover): `docs/agents/design-parity.md`.
- Git (branch name, hooks, rebase, drafts, review, hotfix and rollback): `CONTRIBUTING.md` and `docs/git-workflow/`.
- Production sign-in recovery: `docs/agents/production-recovery.md` and `scripts/verify-auth-production.mjs`.
- Verify (a change under `apps/web` or `apps/api`): the verify skills in `.claude/skills/`.

## Agent skills

- Issue tracker: GitHub issues of `Rickvu309/opencv`. See `docs/agents/issue-tracker.md`.
- Triage labels: only `ready-for-human` is a label; the other triage roles are read from the issue and its PRs. See `docs/agents/triage-labels.md`.
- Domain docs: single-context (`CONTEXT.md` and `docs/adr/`). See `docs/agents/domain.md`.
