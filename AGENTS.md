## Agent skills

### Issue tracker

Issues live in GitHub issues of `quanvu309/opencv`, created from the issue forms in `.github/ISSUE_TEMPLATE/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

### Git

Follow these rules in this repo. They are not optional.
Full details: `CONTRIBUTING.md` and `docs/git-workflow/`.

There is no CI and no GitHub Actions. Local hooks (`.githooks/`) and the review checklist are the only gates, so never bypass them.

#### 1. Issue first
- Never start work without a GitHub issue.
- If no issue exists, create one, or let `scripts/new-task.sh <type> "Issue title"` create it.
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
- Work only inside the printed worktree path (`../<repo>.worktrees/<issue#>-short-description`).
- Use only your assigned port (printed by the script, stored as `PORT` in the worktree's `.env`).
- One agent, one issue, one branch, one worktree. Never touch another agent's worktree.

#### 3. Branch naming
- Format: `type/<issue#>-short-description`, e.g. `feat/42-login-page`.
- Types: `feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`.
- Lowercase kebab-case, 3-5 words, branched from the latest `origin/main`. The pre-push hook rejects other names.

#### 4. Checks, commits, and PRs
- Pushes run a quick check scoped to what changed: `scripts/check.sh --changed` (the pre-push hook does it). The full lint, typecheck and test run once per PR, in `scripts/review-pr.sh`.
- Open the PR with `scripts/open-pr.sh --draft`. It validates the branch, runs the quick check, pushes, and creates the PR with the title `type: description (#<issue>)` and `Closes #<issue>` in the body.
- Before marking ready (`gh pr ready`), the quick check passes and, for a web change, the Vercel preview works.
- If `main` moved ahead: `git fetch origin && git rebase origin/main && git push --force-with-lease`.
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
- Never add GitHub Actions workflows (`.github/workflows/`). The account has no Actions budget.

#### 6. Merge and clean up
- Merge only with squash: `gh pr merge --squash`.
- An agent running under the owner's account (`@quanvu309`) merges its own PR with `gh pr merge <pr#> --squash --admin` once `scripts/review-pr.sh` is OK (it also fails on requested changes and unresolved review threads) and an independent review has no open finding. Do not wait for a human; merge as soon as those pass. `--admin` skips the ruleset, so never use it past one of those. Never for a contributor's PR or a result of `HUMAN REQUIRED`.
- After merge, the issue closes and the remote branch is deleted automatically.
- From the main checkout: `scripts/cleanup-worktree.sh <issue#>`.

#### 7. Production is broken
- Open an issue, run `scripts/new-task.sh hotfix <issue#> -d "..."`, fix, run `scripts/open-pr.sh`, and ask for immediate review.
- If the fix is risky, tell a human to roll back to the previous production deploy on the hosting platform first.

#### Review agent checklist

For the agent that reviews PRs. Run from the main checkout, for every PR marked ready (hotfixes immediately):

1. `scripts/review-pr.sh <pr#>`. It checks the branch name, title, `Closes #`, the issue, the label, mass deletion, committed env files, and up-to-date with `main`, then runs the full `scripts/check.sh` (lint, typecheck, test) once, in a throwaway worktree of the PR.
2. Result `HUMAN REQUIRED` (exit 2): the PR has `needs-human-review` or is a mass deletion. **Do not merge.** Comment your findings and leave it to a human.
3. Result `FAIL` (exit 1), including a committed real `.env` file or a requested-changes review: `gh pr review <pr#> --comment --body "FAIL: <what to fix>"`. Don't merge.
4. Result `OK` (exit 0): for a web change open the Vercel preview and test the changed flow, then read the diff (scope, tests, no secrets; look closely at `package.json` scripts, `scripts/`, `.githooks/`, `.github/`).
5. All good: `gh pr review <pr#> --comment --body "review-pr.sh: OK"`, then merge with `gh pr merge <pr#> --squash`. Otherwise comment what to fix. (One account: GitHub won't take an approval or "request changes" from the PR author.)

Full checklist: `docs/git-workflow/review-and-approval.md`.

### Design system

UI kit: absorb-when-possible, shadcn-style `packages/ui`, Storybook catalog. Run `pnpm dlx shadcn@latest add <name> -c apps/web`. Import through `@workspace/ui/components/<name>` and `@workspace/ui/globals.css`. Colocate `*.stories.tsx` next to each absorbed primitive and import the component from its source file. Local catalog: `pnpm storybook`. App code uses semantic tokens only — no raw hex or named Tailwind palette classes (`bg-red-500`) outside the two ADR-0010 exceptions (CV print paper, tokenized GitHub heatmap). Prefer kit components over raw `<button>`/`<input>`/`<textarea>`/`<select>`. See `docs/adr/0002-design-system.md` and `docs/adr/0010-design-tokens-and-governance.md`.
