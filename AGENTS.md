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
