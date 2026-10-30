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

Write the body with the `pr` skill, using `.github/pull_request_template.md` as the shape: `## Summary`, `## Evidence` (before and after), and `## Merge Danger` with `**Door:**` (one-way or two-way) and `**Blast Radius:**`. Save it to a file and pass it as `scripts/ocv-tools.mjs finish --body-file <file>`. The script refuses a body that lacks a part or still has a placeholder in angle brackets, and puts this line on top:

```
Closes #42
```

That links the PR to the issue and closes the issue when the PR merges into `main`. One PR closes one issue.

## Lifecycle

1. Open a **draft** PR as soon as you have a first commit. Run this inside your worktree:
   ```bash
   scripts/ocv-tools.mjs check
   scripts/ocv-tools.mjs finish --draft --body-file <file>
   ```
   Check runs `node scripts/check.mjs` and saves proof for the tree and base. Finish checks that proof and the branch name, pushes, and creates the PR. The title is `type: description (#N)`, taken from the issue title or set with `-d "..."`. The body is your `--body-file` with `Closes #N` on top. Use `--dry-run` to preview.
2. Keep working; push through `git push`. The pre-push hook runs the quick check.
3. When done: checks pass, the verify-opencv evidence is attached, and the checklist is ticked. Run `gh pr ready`.
4. Read comments, fix them in new commits, and resolve the threads. See `review-and-approval.md`.
5. Rebase when the PR does not merge cleanly with `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   ```
6. Wait until `ci` is green, then enqueue with `scripts/ocv-tools.mjs merge <pr#>`. Then run `scripts/ocv-tools.mjs merge <pr#> --wait` in the background and end the turn until it exits.

## Checks

The `ci` workflow runs parallel affected guards, lint, typecheck, build, two API test shards and three web test shards on GitHub-hosted runners; aggregate `ci` requires every job to succeed. The same checks run locally at these points:

| When                           | What runs                     | What it enforces                                                                                                                                                                      |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git commit`                   | `commit-msg` hook             | No commits on `main`; no empty message                                                                                                                                                |
| `git commit`                   | `pre-commit` hook             | No staged file over 5000 tokens (bytes / 4), except binary and `linguist-generated` files                                                                                             |
| `git push`                     | `pre-push` hook               | No push to `main`; branch name format; `pnpm check` (quick lint, typecheck, test of what changed)                                                                                     |
| `scripts/ocv-tools.mjs finish` | itself                        | Branch name, passing check proof, correct title and `Closes #`                                                                                                                        |
| Merge                          | `scripts/ocv-tools.mjs merge` | Author is the owner, PR is not a draft, no `needs-human-review` label, no mass deletion, title, `Closes #n` and open issue, `ci` is success on the head, gate files carry `risk:high` |

Hooks are on once `git config core.hooksPath .githooks` is set in the clone (`scripts/ocv-tools.mjs take` does it).

**Skipping checks:** `SKIP_CHECKS=1 git push` skips lint/typecheck/test in the hook (the main-branch and naming rules still apply). Use it only in a production emergency, and say so in the PR. `--no-verify` skips the hooks entirely; never use it. A skipped hook is not caught again at merge. `ci` still requires every parallel job to succeed.

## Keep PRs small

- One issue, one concern. Under ~400 changed lines is a good target.
- Unrelated cleanup goes in its own issue and PR.
- If a PR grows past a few days of work, split the issue into sub-issues.
