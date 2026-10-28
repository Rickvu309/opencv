# Review and approval

Every PR goes through review before it merges.

**Owner-only merge.** The `main` ruleset requires 1 approving review and code-owner review, and `CODEOWNERS` lists `@quanvu309` for every path. Contributors have Write access: they push branches and open PRs, but GitHub blocks their merges because only the owner's approval counts. The repo Admin role is a ruleset bypass actor in `pull_request` mode, so `@quanvu309` (who also runs the review agent, because GitHub never lets an account approve its own PR) merges after `gh pr review <pr#> --comment`. An agent working under that account merges its own routine PRs with `heavy -- scripts/merge-pr.sh <pr#>` once the independent review has no open finding. `--admin` skips the ruleset's resolved-threads and review rules, so `scripts/review-pr.sh` checks both before it reports OK. It never does this for a contributor's PR or a PR that needs a human (step 4). It does not wait for a human otherwise. Direct pushes to `main` stay blocked for everyone. The ruleset also enforces squash-only, linear history, resolved threads, and no force-push or deletion. Reapply `.github/rulesets/main.json` after editing it:

```bash
id=$(gh api repos/quanvu309/opencv/rulesets --jq '.[] | select(.name=="main") | .id')
gh api -X PUT "repos/quanvu309/opencv/rulesets/$id" --input .github/rulesets/main.json
```

Write access cannot be made merge-proof by role alone, and contributors can still edit labels, so the `needs-human-review` rule below stays a convention.

There is no CI. Local hooks catch mistakes early, but anyone can bypass them (`git push --no-verify`),
so **the review is the real gate**. Nothing merges without the checklist below.

**Human review only for super important changes.** Owner decision, 2026-10-23: a human reviews a PR only when it is a mass deletion (it deletes 25% or more of the files tracked on `main`, or 80% or more of one app or package) or a big decision flagged with the `needs-human-review` label. Everything else, env and secrets changes included, merges once the checklist passes and the independent review has no open finding.

| PR                                                                                       | Who approves                                                                                                          |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Any change, env and secrets included                                                     | `@quanvu309`'s agent merges after the checklist passes and the independent review is clean. Contributors cannot merge |
| Mass deletion (25% or more of the files on `main`, or 80% or more of one app or package) | A human (`review-pr.sh` reports `HUMAN REQUIRED`)                                                                     |
| Has the `needs-human-review` label (a big decision)                                      | A human (enforced by rule: the review agent never merges it)                                                          |

People can read, comment on, and **request changes** on any PR at any time. A "changes requested" review blocks merge until that person approves or the review is dismissed.

## Review agent checklist

Run this for every PR when it is marked ready, and immediately for `hotfix` PRs. Work from the main checkout (`heavy` caps the run; see AGENTS.md section 4).

```bash
heavy -- scripts/review-pr.sh <pr#>
```

The script does steps 1-6 and prints `OK`, `FAIL`, or `HUMAN REQUIRED`. It never approves.

1. **Branch name** is `type/<issue#>-short-description` (or a `dependabot/` / `renovate/` branch).
2. **PR title** is `type: description (#<issue>)`, and the issue number matches the branch.
3. **Body** contains `Closes #<issue>`, and the issue exists and is open.
4. **Human needed?** Only if the PR has the `needs-human-review` label or is a mass deletion (it deletes 25% or more of the files tracked on `main`, or 80% or more of one `apps/*` or `packages/*` directory with at least 5 files; renames are counted as deletions, so moving a whole app also needs a human): **stop: do not merge**. Review and comment if useful, then leave the decision to a human. Env/secrets paths in `CODEOWNERS` (the file list comes from `git diff --no-renames`, so renames and PRs over 100 files are covered) are only noted; the catch-all `*` line only decides who may merge, so `scripts/review-pr.sh` ignores it here (`scripts/test-codeowners.sh` guards that). A committed real env file (`.env`, `.env.local`, `prod.env`; templates such as `.env.example` are fine) fails the checklist, and so does a requested-changes review.
5. **Merges cleanly:** the checks run on the merge of `main` and the PR head, which is what the squash merge lands, so a branch behind `main` needs no rebase. A merge conflict fails; the author rebases and resolves it. The script prints the `main` and head commits it tested and a patch id that stays the same across a rebase that keeps the diff text (whitespace included). The merge is computed with `git merge-tree` and checked out with hooks off, so none of the PR's hooks and no git identity take part in it; PR code runs during the checks, as before.
6. **Checks pass:** `main` with the PR merged in is checked out in a throwaway worktree (`../opencv.worktrees/review-pr-<n>`), dependencies are installed, and `scripts/check.sh` (full, no `--changed`) from `main` runs lint, typecheck, and test. After that check passes, the same worktree runs `pnpm --filter api... run build` and `pnpm --filter web build`. Either build failing is a FAIL, and both results are cached with the check. This is the one full run per PR; pushes only run `scripts/check.sh --changed`. It uses `main`'s copy so a PR can't weaken its own checks. A passing run is cached by the tested tree when this step adds no FAIL, so a rerun that lands the same tree is free (`--no-cache` reruns it; use it after a node or pnpm upgrade, since the cache key does not cover the toolchain, or when you suspect PR code wrote the cache, which lives beside the worktrees). Items 1-5 run first; a FAIL other than a requested change or an open thread skips this step. The worktree is removed afterwards (`--keep` keeps it).
7. **Verification:** a PR that touches `apps/web/`, `apps/api/`, `packages/ui/`, `packages/domain/` or a verify skill also gets the invariant verify tier from the script: `VERIFY_TIER=invariant` for `verify:app-ui` and `verify:landing`, run in the same worktree after the builds, each checker started directly from `apps/web` so its exit code reaches the gate. The allowed FAILs are each skill's `known-findings.json` on `main` minus the entries the PR deletes (never entries the PR adds). A fix PR deletes its entry: if the check passes the PR is OK, and if it still FAILs that is a new FAIL. A NEW FAIL is rerun once and counts only when it fails in both runs; the message prints both runs. Any other FAIL, a listed finding that now passes (remove its entry), a STALE, an invariant check that is no longer reported, or a checker that exits with anything but 0, 1 or 3 (a hang past 900 s is exit 124) fails the review, and the logs are under the result directory (`review-pr-<pr#>-verify-<name>.log`, and `-run2` for a rerun). A taken port (exit 2 saying so) is retried once on the next free pair. There is no skip flag, and a missing browser is a FAIL. To add a known finding, open an issue first, then land `{ "id", "issue", "since", "note" }` in the skill's `known-findings.json` in its own PR that changes nothing but `known-findings.json` files: the review skips the tier for it and notes it, and the independent review checks the issue is open. A PR that adds an entry and changes anything else fails; land the entry on its own with its issue. The script notes any PR that edits a `known-findings.json`, a checker's or the launcher's `scripts/`, or a `verify:*` script in `apps/web/package.json`; read that diff. The PR also carries verify-opencv evidence for the changed flow (`.claude/skills/verify-opencv`). There are no preview deploys yet.
8. **Read the diff.** It does what the issue asks and nothing unrelated, tests cover it, and there are no secrets, debug code, or commented-out code. Look closely at changes to `package.json` scripts, `scripts/`, `.githooks/`, and `.github/`: they change the gate itself.
9. **Decide:**
   - All good: post one comment with the evidence, then `heavy -- scripts/merge-pr.sh <pr#>`. The comment names the patch id the script printed, which stays the same across a rebase that keeps the diff text, so the review and the verify evidence stay valid for the same patch (lint, typecheck and tests rerun on a new `main`, the runtime verification does not): `review-pr.sh: OK (patch id <id>, main <sha>). Independent review: <who>, approved. verify-<skill>: <result>`. `merge-pr.sh` refuses a PR by another author, reruns `review-pr.sh` (free when the merge tree is unchanged), requires a comment or review with the current patch id and `Independent review` (and `verify` when the PR changes `apps/`), posts the `gates/review-pr` status on the head and merges with `--squash --admin --match-head-commit`. Add `--dry-run` to stop before the status and the merge.
   - Problems: `gh pr review <pr#> --request-changes --body "<what to fix>"`
   - Human needed: `gh pr review <pr#> --comment --body "<findings>. Needs human approval."`

Exit codes of `review-pr.sh`: `0` OK to merge after steps 7-8, `1` request changes, `2` human required (label or mass deletion).

Without the script, do steps 1-6 by hand:

```bash
gh pr view <pr#> --json headRefName,title,body,labels,files,baseRefName,isDraft
git fetch origin main "pull/<pr#>/head:refs/remotes/origin/pr/<pr#>"
tree=$(git --attr-source=origin/main merge-tree --write-tree --name-only --no-messages origin/main origin/pr/<pr#>)   # exit 1 means a conflict, which fails the review
git worktree add --detach --no-checkout ../opencv.worktrees/review-pr-<pr#> origin/main
git -C ../opencv.worktrees/review-pr-<pr#> -c core.hooksPath=/dev/null read-tree -u --reset "$tree"
cd ../opencv.worktrees/review-pr-<pr#> && cp .env.example .env && pnpm install --frozen-lockfile && heavy -- ../../opencv/scripts/check.sh
cd - && git worktree remove --force ../opencv.worktrees/review-pr-<pr#>
```

## The review agent

- Runs under its **own GitHub account** (a machine user with write access), separate from the coding agents. GitHub doesn't count an author's approval of their own PR.
- Is never listed in `CODEOWNERS`.
- Adds `needs-human-review` only for a big decision: dropping a product or a major feature, a migration that loses data, changing pricing or the legal entity, or anything that deletes much of the code base. Risky or large changes that are not such a decision get a careful independent review instead.
- Never merges a PR with the `needs-human-review` label or a mass deletion, even if GitHub would allow it.

## Env and secrets

Env and secrets changes no longer need a human. `.github/CODEOWNERS` lists env/secrets paths with the human team as owners, and `scripts/review-pr.sh` notes when a PR touches them so the reviewer checks no real secret is added:

- `.env*` and `*.env` files anywhere (including `.env.example`)
- `env.*` files and `env/` folders anywhere (env loading/validation code, e.g. `src/env.ts`)
- `/config/env*`
- anything named `*secret*`
- `.github/CODEOWNERS` itself, so nobody can remove these rules without a human

GitHub blocks every merge without `@quanvu309`'s approval or bypass, so contributors still cannot merge them. An agent under the owner's account merges them like any other PR once the checklist passes. A committed real env file fails the checklist.

If you change how env or secrets are handled in a file not covered by `CODEOWNERS`, add the path to `CODEOWNERS` in the same PR.

## The `needs-human-review` label

- It marks a big decision. Anyone (person or agent) can add it to any PR: `gh pr edit <n> --add-label needs-human-review`.
- While it is on, **only a human approves** the PR. The review agent must not merge it.
- GitHub doesn't block this by itself; the rule above enforces it. A human checks the PR's approvals before merging a labeled PR, and only a human removes the label.
- For a hard block on a specific PR, a human can also **request changes**. The PR can't merge until that human approves.

## Approvals and new pushes

- A new push dismisses existing approvals. Rebasing on `main` therefore needs a re-approval, and re-running the checklist.
- All review conversations must be resolved before merge.
