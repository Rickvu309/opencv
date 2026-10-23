# Commits and pull requests

## Commits on your branch

- Commit small and often. Messages should say what changed; Conventional Commits style is welcome but not checked.
- Your branch commits are squashed on merge, so only the PR title ends up on `main`.
- Rewrite your own branch freely (rebase, amend). Push with `--force-with-lease`, never plain `--force`, and never to `main`.

## PR title

```
type: description (#<issue>)
```

- `type` is the branch type: `feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`.
- An optional scope and `!` for breaking changes are allowed: `fix(cart): round totals (#57)`, `feat!: drop v1 API (#80)`.
- Description: lowercase start, imperative, no period. "add login page", not "Added login page."
- `(#<issue>)` is the issue number and must match the branch.
- The title becomes the squash commit message on `main`. GitHub appends the PR number, so `main` shows `feat: add login page (#42) (#61)`: first the issue, then the PR.

## PR body

Use the template (`.github/pull_request_template.md`). It must contain:

```
Closes #42
```

That links the PR to the issue and closes the issue when the PR merges into `main`. One PR closes one issue.

## Lifecycle

1. Open a **draft** PR as soon as you have a first commit. Run this inside your worktree:
   ```bash
   scripts/open-pr.sh --draft
   ```
   It checks the branch name, runs `scripts/check.sh --changed` (quick, scoped to what changed), pushes, and creates the PR. The title is `type: description (#N)`, taken from the issue title or set with `-d "..."`. The body is the PR template with `Closes #N` filled in. Use `--dry-run` to preview.
2. Keep pushing. The pre-push hook runs the quick check; Vercel builds a web preview on every push.
3. When done: checks pass, the preview deploy works, and the checklist is ticked. Run `gh pr ready`.
4. Review (see `review-and-approval.md`). Fix comments in new commits and resolve the threads.
5. If `main` moved ahead, rebase. The reviewer refuses branches that are behind `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   ```
   A new push dismisses earlier approvals, so the reviewer re-runs the checklist and re-approves.
6. Squash-merge: `gh pr merge --squash`.

## Checks (no CI)

There is no GitHub Actions CI. The same checks run locally at these points:

| When | What runs | What it enforces |
|---|---|---|
| `git commit` | `commit-msg` hook | No commits on `main`; no empty message |
| `git commit` | `pre-commit` hook | No staged file over 5000 tokens (bytes / 4), except binary and `linguist-generated` files |
| `git push` | `pre-push` hook | No push to `main`; branch name format; `scripts/check.sh --changed` (quick lint, typecheck, test of what changed) |
| `scripts/open-pr.sh` | itself | Branch name, `scripts/check.sh --changed`, correct title and `Closes #` |
| Review | `scripts/review-pr.sh` | Branch, title, `Closes #`, issue open, up to date with `main`, full `scripts/check.sh` in a clean worktree (the one full run per PR), mass deletion and `needs-human-review` (human required), committed env files |

The file-size rule has one exception: `docs/plans/*.md` is marked `linguist-generated` in `.gitattributes` because the planning swarm writes those program plans and trails, so they may exceed the limit.

Hooks are on once `git config core.hooksPath .githooks` is set in the clone (`scripts/new-task.sh` does it).

**Skipping checks:** `SKIP_CHECKS=1 git push` skips lint/typecheck/test in the hook (the main-branch and naming rules still apply). Use it only in a production emergency, and say so in the PR. `--no-verify` skips the hooks entirely; never use it. Either way, the reviewer runs the checks again.

## Keep PRs small

- One issue, one concern. Under ~400 changed lines is a good target.
- Unrelated cleanup goes in its own issue and PR.
- If a PR grows past a few days of work, split the issue into sub-issues.
