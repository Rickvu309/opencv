## Set up the git workflow (PR-1)

**Depends on.** None.

The model is that the workflow copies the airdesign repo (`/home/quan/projects/airdesign`) with no id-scheme adaptation. Work is tracked in GitHub issues on `quanvu309/opencv`, branches are `type/<issue#>-short-description`, PR titles are `type: description (#<issue>)` and the PR body says `Closes #<issue>`. The Linear project is left as is. The owner copies the code from airdesign and changes only repo names and adds opencv's triage labels; this plan names files and behaviors only.

**Files.**

- [ ] Delete `.github/workflows/` (today it holds only `ci.yml`).
- [ ] Create `.githooks/commit-msg`, `.githooks/pre-commit` and `.githooks/pre-push`.
- [ ] Create `scripts/check.sh`, `scripts/new-task.sh`, `scripts/open-pr.sh`, `scripts/review-pr.sh` and `scripts/codeowners-lib.sh`.
- [ ] Create `scripts/test-commit-msg.sh`, `scripts/test-pre-commit.sh` and `scripts/test-codeowners.sh`.
- [ ] Create `.github/rulesets/main.json`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `chore.yml` and `config.yml`, and `.github/labels.yml`.
- [ ] Create `.gitattributes` and `CONTRIBUTING.md`.
- [ ] Create `docs/git-workflow/branch-naming.md`, `commit-and-pr-conventions.md`, `review-and-approval.md`, `worktrees.md` and `deploys-and-hotfixes.md`.
- [ ] Edit `AGENTS.md` (the `### Git` block and the `### Issue tracker` line) and rewrite `docs/agents/issue-tracker.md` to GitHub issues.

**Build.**

- [ ] `.github/workflows/`. Delete the directory with `git rm -r .github/workflows`; the repo runs no GitHub Actions, now or later, and the swarm's gates lane stands in for CI.
- [ ] `.githooks/commit-msg`. Copy from airdesign unchanged; it refuses commits on `main`, an empty first line, and `Co-authored-by:` or `Generated-with:` trailers, and warns above 72 characters.
- [ ] `.githooks/pre-commit`. Copy from airdesign unchanged; it rejects a staged file over 20000 bytes unless it is linguist-generated or binary, and prints the split recipe.
- [ ] `.githooks/pre-push`. Copy from airdesign unchanged, with `BRANCH_RE` `^(feat|fix|hotfix|refactor|chore|docs)/[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$`, the bot-branch regex, the no-push-to-main rule, the `scripts/check.sh --changed` run and the `SKIP_CHECKS=1` emergency escape.
- [ ] `scripts/check.sh`. Copy from airdesign; run `lint`, `typecheck` and `test` through turbo at the root, support `--changed` (changed workspace packages only), `CHECK_DRY_RUN=1` and pnpm detection, and drop the mascot-budget and slow-test bits.
- [ ] `scripts/new-task.sh`. Copy from airdesign; take an existing issue number or a description, check the issue with `gh issue view` or create it with `gh issue create` labeled by type, then create `../opencv.worktrees/<issue#>-<desc>` on branch `type/<issue#>-<desc>`, copy `.env.example`, set `PORT` by airdesign's rule, install, and set `core.hooksPath` to `.githooks`.
- [ ] `scripts/open-pr.sh`. Copy from airdesign; validate the branch and the title `type: description (#<issue>)`, run the quick check, push, and create the PR from the template with the body line `Closes #<issue>`, and support `--dry-run` that prints title and body and pushes nothing.
- [ ] `scripts/review-pr.sh`. Copy from airdesign with its `BRANCH_RE`, `BOT_RE` and `TITLE_RE` regexes unchanged and the repo slug `quanvu309/opencv`; check branch, title and the `Closes #<issue>` body line, flag HUMAN REQUIRED for mass deletion or the `needs-human-review` label, scan for secrets, run the full `scripts/check.sh` in a throwaway worktree, print OK, FAIL or HUMAN REQUIRED, and never approve.
- [ ] `scripts/test-commit-msg.sh`, `scripts/test-pre-commit.sh`, `scripts/test-codeowners.sh` and `scripts/codeowners-lib.sh`. Copy from airdesign as the hooks' own tests and helper, adapting only repo names.
- [ ] `.github/rulesets/main.json`. Copy from airdesign with the four rules `deletion`, `non_fast_forward`, `required_linear_history` and `pull_request` (one approval, code-owner review required, stale reviews dismissed, threads resolved, `squash` as the only merge method), admin bypass in `pull_request` mode, and no status check and no `preview-deploy-check.json`; the root applies it after merge.
- [ ] `.github/CODEOWNERS`. Copy from airdesign with the catch-all `* @quanvu309` first and a comment naming the opencv repo.
- [ ] `.github/pull_request_template.md`. Copy from airdesign with the sections title hint, `Closes #<issue>`, What changed, Why, How to test and Checklist, where the preview-deploy item becomes "gates lane report is green on the exact head".
- [ ] `.github/dependabot.yml`. Set `version: 2` and one `npm` entry with directory `/`, schedule `weekly`, a `groups` key `minor-and-patch` covering `minor` and `patch`, and `commit-message.prefix` `deps`, with no `github-actions` entry.
- [ ] `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `chore.yml` and `config.yml`. Copy the four issue forms from airdesign, adapting only the repo name; each form applies its type label.
- [ ] `.github/labels.yml`. Copy airdesign's type labels (`feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`, `needs-human-review`) and add opencv's triage labels from `docs/agents/triage-labels.md`, namely `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` and `wontfix`.
- [ ] `.gitattributes`. Add `linguist-generated` entries for `pnpm-lock.yaml` and `apps/api/drizzle/**` so the pre-commit size rule skips them.
- [ ] `CONTRIBUTING.md`. Write the opencv version of airdesign's file with the same headings (no CI, short version with the mermaid flow, main only, issue first, branch naming, worktrees, commits and PRs, review, deploys), GitHub-issue wording, the `git config core.hooksPath .githooks` step, and no preview section until PR-3.
- [ ] `docs/git-workflow/branch-naming.md`, `commit-and-pr-conventions.md`, `review-and-approval.md` and `worktrees.md`. Write the opencv versions of airdesign's four files with `#<issue>` wording and the `type/<issue#>-short-description` branch, `type: description (#<issue>)` title and `Closes #<issue>` body formats.
- [ ] `docs/git-workflow/deploys-and-hotfixes.md`. Describe Railway deploys as they are today and state that PR-3 changes them.
- [ ] `AGENTS.md`. Rewrite the `### Git` block in the shape of airdesign's "Agent rules, Git workflow" with GitHub-issue wording, covering issue first, own worktree via `scripts/new-task.sh`, branch naming, pushes run the quick check, `scripts/open-pr.sh`, never push `main`, never `--no-verify`, never `SKIP_CHECKS=1`, human review only for mass deletion or `needs-human-review`, and the rule "never add GitHub Actions workflows".
- [ ] `docs/agents/issue-tracker.md` and the `### Issue tracker` line in `AGENTS.md`. Rewrite `docs/agents/issue-tracker.md` to GitHub issues on `quanvu309/opencv` (create with `gh issue create`, read with `gh issue view`, labels from `.github/labels.yml`) and add a `## Pull requests` section with the title, branch and body formats, the squash-only merge, the gates-lane check, and links to `.github/pull_request_template.md` and `docs/git-workflow/`; change the `### Issue tracker` line in `AGENTS.md` to point at GitHub issues; leave the Linear project as is.
- [ ] Out of scope for this diff, owner step. After the files are committed, the owner syncs labels once with `gh label create --force` for every entry in `.github/labels.yml` and creates one GitHub issue for PR-1 itself with `gh issue create` (root-authorized remote writes); the PR-1 branch and PR use that issue number.
- [ ] Out of scope for this diff, root step. The root runs `git config core.hooksPath .githooks`, applies `.github/rulesets/main.json` with `gh api -X POST repos/quanvu309/opencv/rulesets --input .github/rulesets/main.json` (or PUT to the existing id), and sets squash title `PR_TITLE`, squash message `BLANK`, `allow_auto_merge` off and delete-branch-on-merge on.

**You see.**

- [ ] `ls .github/workflows` prints nothing or fails with `No such file or directory`, `git ls-files .github/workflows` prints nothing, and `AGENTS.md` says never add GitHub Actions workflows.
- [ ] `scripts/test-commit-msg.sh`, `scripts/test-pre-commit.sh` and `scripts/test-codeowners.sh` each exit 0, and `CHECK_DRY_RUN=1 scripts/check.sh` prints the lint, typecheck and test commands without running them.
- [ ] A commit on `main` is refused by `commit-msg`, and a 20,001-byte staged file is refused by `pre-commit` with the split recipe.
- [ ] A push of a branch named `feature/bad` is refused by `pre-push`, and `feat/12-add-x` passes the branch check.
- [ ] `scripts/open-pr.sh --dry-run` on a `type/<issue#>-desc` branch prints the title `type: description (#<issue>)` and the body line `Closes #<issue>`.
- [ ] `scripts/review-pr.sh <pr#>` on this PR prints OK, and on a scratch PR with a bad title prints FAIL and leaves no approval.
- [ ] `.gitattributes` marks `pnpm-lock.yaml` and `apps/api/drizzle/**` as `linguist-generated`, and `.github/dependabot.yml` parses to one `npm` ecosystem, weekly and grouped.
- [ ] `CONTRIBUTING.md`, the five `docs/git-workflow/*.md` files, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/labels.yml` and the four `.github/ISSUE_TEMPLATE/*.yml` files exist, and the docs name `#<issue>`.
- [ ] After the root's ops step, `gh api repos/quanvu309/opencv/rulesets/<id>` shows the four rules and `gh api repos/quanvu309/opencv/codeowners/errors --jq '.errors | length'` reads 0.
- [ ] After the owner's label sync, `gh issue view <n>` for PR-1's issue exists and is labeled, and `gh label list` shows every label in `.github/labels.yml`, including `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` and `wontfix`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Run `scripts/test-commit-msg.sh`, `scripts/test-pre-commit.sh` and `scripts/test-codeowners.sh` at the head; each exits 0.
- [ ] Run `bash -n` on every file in `scripts/*.sh` and `.githooks/*`, then `CHECK_DRY_RUN=1 scripts/check.sh`; every `bash -n` exits 0 and the dry run exits 0 with the planned commands printed.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm turbo run lint typecheck build test` at trunk and at head in two worktrees, each after `pnpm install --frozen-lockfile`. Save `ci-regression.png` as evidence. Pass when both runs exit 0 with the same task list and the head web test summary still reads 478 passed, 1 skipped.
- [ ] Lane 2. In a throwaway clone under `~/tmp` with `core.hooksPath` set to the head's `.githooks`, run `git commit --allow-empty -m "chore: x"` on `main`, then on a `chore/1-x` branch, then with a `Co-authored-by:` trailer. Save `commit-msg-main.png` as evidence. Pass when the commit on `main` and the trailer commit are refused and the plain commit on the feature branch succeeds.
- [ ] Lane 3. In the same clone, stage a 20,001-byte file, then a 20,000-byte file, then a 30,000-byte `pnpm-lock.yaml`, and run `git commit` each time. Save `pre-commit-size.png` as evidence. Pass when the 20,001-byte commit is refused with the split recipe and the other two succeed.
- [ ] Lane 4. Add a local bare remote, then run `git push --dry-run` from branches `feature/bad`, `main` and `feat/12-add-x` with `SKIP_CHECKS` unset. Save `pre-push-branch.png` as evidence. Pass when `feature/bad` and `main` are refused by `pre-push` and `feat/12-add-x` passes the branch check.
- [ ] Lane 5. Run `scripts/new-task.sh` against a scratch GitHub issue created with `gh issue create`, then with no argument and with a malformed argument. Save `new-task.png` as evidence. Pass when the first run checks the issue with `gh issue view`, creates `../opencv.worktrees/<issue#>-scratch-hooks` on branch `chore/<issue#>-scratch-hooks` with `core.hooksPath` `.githooks`, the other two are refused, and the scratch worktree, branch and issue (closed) are removed afterward.
- [ ] Lane 6. On a `docs/<issue#>-scratch` branch, run `scripts/open-pr.sh --dry-run`. Save `open-pr-dry-run.png` as evidence. Pass when it prints the title `docs: scratch (#<issue>)` and the body line `Closes #<issue>` and creates no PR.
- [ ] Lane 7. Run `scripts/review-pr.sh <pr#>` on PR-1 itself, then on a scratch PR titled `update stuff`, then `gh pr view <scratch> --json reviews --jq '.reviews | length'`. Save `review-pr.png` as evidence. Pass when PR-1 prints OK, the scratch PR prints FAIL, and the review count reads 0.
- [ ] Lane 8. Run `ls .github/workflows`, `git ls-files .github/workflows`, `git grep -n -E "uses:|runs-on:" -- .github` and `grep -n "GitHub Actions" AGENTS.md`. Save `no-actions.png` as evidence. Pass when the first three print nothing or fail as missing and the grep finds the "never add GitHub Actions workflows" rule.
- [ ] Lane 9. After the root's ops step, run `gh api repos/quanvu309/opencv/rulesets/<id> --jq '[.rules[].type]'`, `gh api repos/quanvu309/opencv/codeowners/errors --jq '.errors | length'` and `gh api repos/quanvu309/opencv --jq '[.allow_auto_merge,.delete_branch_on_merge]'`. Save `ruleset-readback.png` as evidence. Pass when the rule types are `deletion`, `non_fast_forward`, `required_linear_history` and `pull_request` with no status check, the error count is 0, and the pair reads `[false,true]`.
- [ ] Lane 10. Audit lane. Read the diff against the **Build** boxes, grep `AGENTS.md` and `docs/agents/issue-tracker.md` for `squash`, `gh issue`, `GitHub Actions`, `ruleset` and `gates lane`, run `gh issue view <n>` for PR-1's issue and `gh label list`, and parse `.github/dependabot.yml`, `.github/labels.yml`, `.github/ISSUE_TEMPLATE/*.yml` and `.github/rulesets/main.json` with `pnpm dlx js-yaml`. Save `docs-audit.png` as evidence. Pass when every Build file exists, all five terms appear in both docs, the issue is labeled and `gh label list` shows every label in `.github/labels.yml`, every file parses, and the diff touches no path outside the PR-1 file boundary.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of one `git commit` of a 5-file, 2 KB change in seconds, with the hooks on and with `core.hooksPath` unset.
- [ ] Probe. Run the commit five times per side in a throwaway clone, interleaved, timing each with `/usr/bin/time -f %e`, and take the median per side.
- [ ] Baseline. Record the hooks-off median first.
- [ ] Rule. The hooks-on median must be at most 1.0 second above the hooks-off median. A larger gap fails.

**Review gate.** None. PR-1 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
