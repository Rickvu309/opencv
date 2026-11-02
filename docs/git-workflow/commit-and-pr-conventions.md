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

1. Open the PR as soon as you have a first commit; add `--draft` to open it as a draft. Run this inside your worktree:
   ```bash
   scripts/ocv-tools.mjs finish --body-file <file>
   ```
   Finish runs the pull request rules early (the rows whose moment is `finish` in `rule-enforcement.md`), pushes through the hooks, and creates the PR. The title is `type: description (#N)`, taken from the issue title or set with `-d "..."`. The body is your `--body-file` with `Closes #N` on top. Use `--dry-run` to preview.
2. Keep working; push through `git push`. The pre-push hook runs the push rules and the quick checks on the changed files; tests, types and build run in CI and the merge queue.
3. When done: checks pass, the verify-opencv evidence is attached, and the checklist is ticked. A draft needs `gh pr ready`.
4. Read comments, fix them in new commits, and resolve the threads. See `review-and-approval.md`.
5. Rebase when the PR does not merge cleanly with `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   ```
6. Wait until `ci` is green, then enqueue with `scripts/ocv-tools.mjs merge <pr#>`. Then run `scripts/ocv-tools.mjs merge <pr#> --wait` in the background and end the turn until it exits.

## Checks

The `ci` workflow runs parallel affected guards, lint, typecheck, build, two API test shards, three web test shards and a `policy` job on GitHub-hosted runners; aggregate `ci` requires every job to succeed. The `policy` job runs the server-held pull request rules (`scripts/ocv-tools.mjs policy <pr#>`) on every pull request and merge-queue run and prints one error annotation per refusal with its fix. The same checks run locally at these points:

| When                           | What runs                     | What it enforces                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git commit`                   | `commit-msg` hook             | Shim over `scripts/ocv-tools.mjs hook commit-msg`: the `commit` rows `ON_MAIN`, `EMPTY_MESSAGE` and `NO_AI_ATTRIBUTION`                                                                                                                         |
| `git commit`                   | `pre-commit` hook             | Shim over `hook pre-commit`: formats staged files with prettier, then `FILE_SIZE` (no staged file over 5000 tokens, bytes / 4, except binary and `linguist-generated` files)                                                                    |
| `git push`                     | `pre-push` hook               | Shim over `hook pre-push`: the `push` rows `NO_PUSH_MAIN`, `BRANCH_NAME`, `SKIP_DECLARED` and `QUICK_CHECKS` (prettier and eslint on the changed files, `scripts/no-comments.mjs`, the fast guards in `scripts/ocv-tools/jobs/push-checks.mjs`) |
| `scripts/ocv-tools.mjs finish` | itself                        | The `finish` rows: ready-for-human, main checkout, port, workflows, attribution, file size, mass deletion, correct title and `Closes #`                                                                                                         |
| Merge                          | `scripts/ocv-tools.mjs merge` | Author is the owner, PR is not a draft, no `needs-human-review` label, no mass deletion, title, `Closes #n` and open issue, `ci` is success on the head, gate files carry `risk:high`                                                           |

The three hooks in `.githooks` are shims: each runs `scripts/ocv-tools.mjs hook <name>`, which gathers facts and calls `decide("commit")` or `decide("push")` on the one rule table (`rule-enforcement.md` lists each row's moments). Hooks are on once `git config core.hooksPath .githooks` is set in the clone (`scripts/ocv-tools.mjs take` does it).

**Skipping checks:** `SKIP_CHECKS=1 git push` skips the quick checks in the hook (the push rules still apply, and `SKIP_DECLARED` wants a human named in `SKIP_CHECKS_DECLARED_BY`). Use it only in a production emergency, and say so in the PR. `--no-verify` skips the hooks entirely; never use it. A skipped hook is not caught again at merge. `ci` still requires every parallel job to succeed.

## Keep PRs small

- One issue, one concern. Under ~400 changed lines is a good target.
- Unrelated cleanup goes in its own issue and PR.
- If a PR grows past a few days of work, split the issue into sub-issues.
