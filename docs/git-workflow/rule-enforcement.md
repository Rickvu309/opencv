# PR workflow rules and what enforces them

The rules in `AGENTS.md` sections 2 to 6, each paired with the script that checks it. A check prints one line that names the
fix and records it as `next` in the script's `result.json` (cause `hygiene`). A rule with no check is a judgment rule; the
reviewer applies it, and the last column says why a script cannot.

| Rule (AGENTS.md section)                                         | Enforced by                                                                                                                                                          | Fix it names                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Never edit files in the main checkout (2)                        | `open-pr.sh` and `merge-pr.sh`: the main checkout must be on `main` with no edited tracked file                                                                      | Move the edit to a worktree, then `git -C <main> restore --staged --worktree .`                 |
| Use only your assigned port (2)                                  | `new-task.sh` records the port in the worktree's git dir; `open-pr.sh` fails if `.env` has another `PORT`                                                            | `sed -i -E 's/^PORT=.*/PORT=<assigned>/' .env`                                                  |
| Never touch another agent's worktree (2)                         | Judgment rule: git records no agent identity (one account, one author), so nothing tells whose hands edited a worktree                                               | None                                                                                            |
| Heavy commands run through `heavy` (4)                           | `open-pr.sh`, `review-pr.sh` and `merge-pr.sh` refuse to run without `HEAVY_SLOT`, which `heavy` exports (`--dry-run` needs no slot)                                 | `heavy -- scripts/<name>.sh <args>`                                                             |
| Never use `--no-verify` (5)                                      | `.githooks/pre-push` stamps every pushed sha; `open-pr.sh` (after its push) and `merge-pr.sh` (the PR head) refuse a sha with no stamp                               | `git commit --amend --no-edit && heavy -- git push --force-with-lease` (the push runs the hook) |
| Never use `SKIP_CHECKS=1` without a human-declared emergency (5) | `open-pr.sh` needs `SKIP_CHECKS_DECLARED_BY=<who>` and writes it in the PR body; the hook stamps `skip`; `merge-pr.sh` refuses a `skip` head the body never mentions | `SKIP_CHECKS_DECLARED_BY=<who>`, or `gh pr edit <pr> --body ...` naming the emergency           |
| Never pick up an issue labeled `ready-for-human` (5)             | `new-task.sh` and `open-pr.sh` read the issue's labels                                                                                                               | Pick another issue                                                                              |
| Never add GitHub Actions workflows (5)                           | `open-pr.sh` (the branch diff) and `merge-pr.sh` (the PR diff) refuse a path under `.github/workflows/`                                                              | `git rm --cached -r .github/workflows && git commit --amend --no-edit`                          |

The checks live in `scripts/lib/rules.sh`; `scripts/test-rules.sh`, `open-pr.test.mjs`, `test-merge-pr.sh`, `test-review-pr.sh` and
`test-new-task.sh` each reproduce the violation and assert the refusal. A hook-less clone, a head pushed before the stamps existed,
and a worktree created before `new-task.sh` recorded its port are skipped, not blocked.

Not enforced yet, and why: splitting long work into sub-issues (a size judgment), verify evidence before `gh pr ready` (`merge-pr.sh`
checks it at merge), never approving with the review agent's identity (one account), and the post-merge cleanup (`cleanup-worktree.sh` is run by hand).
