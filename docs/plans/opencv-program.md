# OpenCV program plan

OpenPath becomes OpenCV. The repo `quanvu309/openpath` is renamed, the brand and code strings follow, the git workflow gets server-side guards, the api and web code lose their proven duplication and the eight files over 500 lines, Storybook is removed, two project-local verification skills land, a Linear-style landing page replaces the `/` redirect, and hosting moves to Railway behind `opencv.me` on Cloudflare. The rule the program enforces is that nothing merges without a swarm verdict on the real artifact, and nothing irreversible (repo rename, DNS, `AUTH_URL` flip, Vercel teardown) runs without a fresh operator go. PR order is PR-1, PR-2, PR-4, PR-9, PR-10, PR-15 first (independent), then PR-18, PR-16, PR-5, PR-6, PR-7, PR-8, PR-11, PR-12, PR-13, PR-14, PR-3, PR-17 by dependency.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-full.md` (local path `/home/quan/.claude/skills/poteto-mode/playbooks/autopilot-full.md`). Each PR owner squash-merges its own PR after the root's clean verdict. The operator's items that stop at merge-ready are PR-3, PR-11 and PR-17 (review-gated), plus the ops steps O1, O3 and O4 below, which the root runs only on an explicit go for each.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

Harness note. This program runs in Claude Code on one machine, not Cursor cloud. Owners and lanes are `Agent` subagents in their own git worktrees under `/home/quan/projects/opencv.worktrees/`. `control-ui` is not installed, so lanes drive the browser with the `agent-browser` skill, and from PR-15 onward through `.claude/skills/verify-opencv/SKILL.md`. Owners write code on `sonnet`. PR-3, PR-13 and PR-16 go to `opus`. Lanes run on `sonnet`.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-full.md` (local fallback `/home/quan/.claude/skills/poteto-mode/playbooks/autopilot-full.md`, since the repo does not vendor pstack)
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md` (local fallback `/home/quan/.claude/skills/swarm/SKILL.md`)
  - [ ] `git show origin/main:.claude/skills/verify-opencv/SKILL.md` (exists after PR-15 merges; before that, `/home/quan/.claude/skills/agent-browser/SKILL.md`)
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md` (local fallback `/home/quan/.claude/skills/poteto-mode/playbooks/opening-a-pr.md`)
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/babysit.md`, `playbooks/shipping.md`, `references/bugbot-triage.md`, and the leaf skills `deslop`, `no-comments`, `technical-writing`, `unslop`, `show-me-your-work` (local fallbacks under `/home/quan/.claude/skills/`)
- [ ] On the operator's go, arm the audit tick as `/loop 1h` with the tick prompt below. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk. Audit the operation against it and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then post a short status message to the operator in chat only when the audit found a tracked change that no earlier status message reported, such as a PR opened, a code-ready head, a round launched or closed, a verdict, a merge, a stuck agent and the action taken, a blocker added or cleared, or a decision only the operator can make. Name every such change and nothing else. Do not repeat a table, the merged list, or an unchanged blocker. If the audit found none, end the turn with no reply text. Either way, log this tick's row in your decision trail. The row names the items reported, or none."
- [ ] Start the decision trail at `docs/plans/opencv-program-trail.md` per the show-me-your-work skill and commit it with PR-1.
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Run the root-owned ops steps. Each is reversible unless marked, and each marked one waits for its own operator go.
  - [ ] O1 (operator go required). Rename the GitHub repo with `gh repo rename opencv --repo quanvu309/openpath --yes`, set the homepage later in O4, then `git remote set-url origin git@github.com:quanvu309/opencv.git` in the checkout and every worktree. Evidence is `gh repo view quanvu309/opencv --json nameWithOwner`. GitHub redirects the old name; never create a new repo named `openpath` under this owner.
  - [ ] O1b. Rename the Railway project to `opencv` in the dashboard (the CLI has no project rename) and the Linear project to `OpenCV` via the Linear MCP `save_project`. Evidence is `railway status --json` and `list_projects`.
  - [ ] O2. Tag then delete the six stale remote branches. `git tag archive/prototype-app-shell 3496338 && git tag archive/main-2026-08-20 aa4d1a2 && git push origin --tags`, then `git push origin --delete archive prototype/app-shell cursor/absorb-ui-kit-primitives-f11f cursor/qve-103-ci-red-check-63ec cursor/qve-149-coach-receipt-reversal-47cc cursor/setup-cloud-agent-environment-5ded`. Evidence is `git ls-remote --heads origin` showing only `main` and live PR branches.
  - [ ] O2b. Repo settings via `gh api -X PATCH repos/quanvu309/opencv -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK -F allow_auto_merge=true -F allow_update_branch=true`. Then a ruleset on `main` via `gh api repos/quanvu309/opencv/rulesets` requiring a pull request, the `ci` status check, linear history, and blocking force-push and deletion. If the API answers that rulesets need a paid plan on a private repo, record the gap in the trail and rely on the PR-1 workflow checks. Evidence is the `gh api` read-back.
  - [ ] O3 (operator go required, after PR-3 merges). Railway and Cloudflare cutover per `docs/deploy.md` from PR-3. Create the `web` service in both environments from the repo, run `railway config migrate cutover`, add custom domains `opencv.me`, `www.opencv.me`, `api.opencv.me`, `staging.opencv.me`, `api-staging.opencv.me`, write the CNAME and TXT records in zone `f299eac876d2b01120126f2ecd6d5545` with the token from `~/.config/secrets/cloudflare.env`, set Cloudflare SSL mode to Full, add the new origins to `WEB_ORIGINS` while keeping the old ones, deploy web with the new `VITE_API_URL`. Evidence is `curl -sI https://opencv.me` and `curl -s https://api.opencv.me/health` both 200, and one sign-in on `https://opencv.me`.
  - [ ] O4 (operator go required, irreversible for signed-in users). Flip production `AUTH_URL` to `https://api.opencv.me` (forces one re-login), set the GitHub homepage to `https://opencv.me`, and after a two-week overlap remove the Vercel origins from `WEB_ORIGINS`. Then delete the Vercel projects with `vercel project rm openpath-app --yes` (team `rickvudev`, id `prj_dHBB26S0q0fGEt6Hj0WyX5ZeAUms`). The Storybook project goes earlier, right after PR-18 merges, with `vercel project rm openpath-storybook --yes` (id `prj_wnYU4a2YOHGpcd72wrXvmisvgsgt`). Evidence is `vercel project ls` without either name.
- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names.
- [ ] Follow this dependency graph. Start dependent work only after its parent merges.
  - [ ] PR-1, PR-2, PR-4, PR-9, PR-10 and PR-15 are independent and first. All branch from `main`.
  - [ ] PR-16 after PR-15. PR-5 after PR-16.
  - [ ] PR-6 after PR-4. PR-7 after PR-6. PR-8 after PR-7.
  - [ ] PR-11 after PR-10. PR-12 after PR-11. PR-13 after PR-12. PR-14 after PR-13.
  - [ ] PR-18 after PR-1. PR-3 after PR-2 and PR-18. PR-17 after PR-2, PR-9 and PR-15.
- [ ] Hold the file boundaries. PR-1 touches only `.github/**`, `AGENTS.md`, `docs/agents/**`, `docs/plans/**`. PR-2 touches brand strings, docs and `docs/adr/0011-*`. PR-3 touches `apps/web/Dockerfile`, `apps/web/Caddyfile`, `.railway/**`, `railway.json`, `vercel.json`, `docs/deploy.md`, `docs/railway.md`, `docs/adr/0012-*`, `.env.example`, `apps/web/src/test/deploy-config.test.ts`. PR-4 to PR-8 touch only `apps/api/**` and `packages/domain/**` (PR-7 also `docs/railway.md` and `.env.example`). PR-9 to PR-14 touch only `apps/web/**` and `packages/ui/**`. PR-15 touches `.claude/skills/verify-opencv/**`, `apps/api/src/index.ts`, `apps/api/src/config.ts`, `apps/api/src/config.test.ts`, `.gitignore`. PR-16 touches `.claude/skills/verify-apply-scan-guard/**`, `apps/api/src/apply/*.formal.test.ts`, `apps/api/vitest.config.ts`, `apps/api/vitest.formal.config.ts`, `apps/api/package.json`, `pnpm-lock.yaml`. PR-17 touches `apps/web/src/features/landing/**`, `apps/web/src/router.tsx`, `apps/web/public/landing/**`. PR-18 touches `packages/ui/**`, `package.json`, `turbo.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `.gitignore`, `README.md`, `AGENTS.md`, `docs/deploy.md`, `docs/adr/0013-*`, `apps/web/src/test/storybook-catalog.test.ts`, `apps/api/src/coach/eval/exclusion.test.ts`.
- [ ] Hold the review gate. PR-3, PR-11 and PR-17 change an interaction or a cutover. They wait for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. `gh` is the forge for this program (`command -v origin` fails on this machine). Never require `gt`.
- [ ] Open the PR ready, never draft, per **Opening a PR**, with `gh pr create --base main`. Title pattern `QVE-<n>: <subject>` when a Linear ticket exists, else `chore: <subject>`, `fix: <subject>`, `docs: <subject>` or `ci: <subject>`. Every commit and PR is authored by `rickvu <minhquanvu3902@gmail.com>` with no AI trailers and no `--no-verify`.
- [ ] Run `pnpm turbo run lint typecheck build` and the touched package's tests once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before the code-ready report and babysit. Keep that merge base in fix rounds. Rebase again only at merge prep, on a `git merge-tree` conflict with trunk, or on a CI failure that comes from a change on trunk.

### Verdict and merge, for every PR

- [ ] A full swarm runs once, at the code-ready head. Another full swarm runs only for new behavior, a redesign, or a large new diff. A rebase, a merge-conflict resolution, or a minor fix gets a single verifier at the new head. Run each full swarm per `pstack/skills/swarm/SKILL.md` on `sonnet`. One gates lane (`pnpm turbo run lint typecheck build test` at the head). The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. Two audit lanes, one reading the diff against the PR's **Build** boxes and one reading the receipts against the **You see** boxes, both distrusting the PR body. The root audits the receipts in the merge-ready report before the verdict.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner, including a defect that a lane filed as a note. A new head gets a fresh verdict, except for results that stay valid under the patch-id rule in `playbooks/shipping.md`.
- [ ] The owner squash-merges only what the root verified, after a rebase onto current trunk with the patch-id unchanged and green CI on that head. PR-3, PR-11 and PR-17 stop at merge-ready for the operator's click.

### Boot recipe, for every live lane

Each live lane runs in its own git worktree at the PR head on this machine. Drive through the `agent-browser` skill, and from PR-15 onward through `.claude/skills/verify-opencv/SKILL.md`.

- [ ] `git -C /home/quan/projects/opencv worktree add /home/quan/projects/opencv.worktrees/<pr-id>-lane-<n> <head SHA>` then `pnpm install --frozen-lockfile` there.
- [ ] Start the api with `DB_DRIVER=pglite PORT=<free port> WEB_ORIGINS=http://localhost:<web port> COACH_RUNTIME=fake pnpm --filter api dev` and wait for `GET /health` to answer 200. Before PR-15 merges, a lane that needs a database starts the api from a PGlite harness it writes under `~/tmp`, never against Railway. Start the web with `VITE_API_URL=http://localhost:<api port> pnpm --filter web dev --port <web port>` and wait for the Vite ready line.
- [ ] Deliver input only through the browser automation or `curl`. Read-only diagnostics are the api log, the Vite log, and the browser console.
- [ ] Save every screenshot to `/home/quan/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report. Remove the worktree after the report; never remove the screenshots.

## Set up the git workflow (PR-1)

**Depends on.** None.

**Files.**

- [ ] Create `.github/pull_request_template.md`.
- [ ] Create `.github/workflows/pr-title.yml`.
- [ ] Create `.github/dependabot.yml`.
- [ ] Create `apps/web/src/test/github-workflow-config.test.ts`.
- [ ] Edit `.github/workflows/ci.yml`.
- [ ] Edit `AGENTS.md`.
- [ ] Edit `docs/agents/issue-tracker.md`.

**Build.**

- [ ] In `.github/pull_request_template.md`, add five sections in this order, `Ticket` (a QVE id such as `QVE-123`), `What and why`, `Verification evidence` (command output or a screenshot path), `Deploy impact` (env vars, migrations, domains, or "none"), and a checkbox `- [ ] The PR title matches QVE-123: summary`.
- [ ] In `.github/workflows/pr-title.yml`, add a workflow named `pr-title` with one job `pr-title`, triggered on `pull_request` types `opened`, `edited`, `synchronize`, `reopened`, with `permissions: contents: read`. Pass the title through `env: TITLE: ${{ github.event.pull_request.title }}` and check it in bash with the pattern `^(QVE-[0-9]+|chore|docs|fix|ci|deps): .+`. On a miss, print the pattern and three valid examples, then `exit 1`.
- [ ] In `.github/dependabot.yml`, set `version: 2` and two entries. The `npm` entry uses directory `/`, schedule `weekly`, a `groups` key `minor-and-patch` with `update-types` `minor` and `patch`, and `commit-message.prefix` `deps`. The `github-actions` entry uses directory `/`, schedule `monthly`, and `commit-message.prefix` `ci`. Majors stay manual and unlisted.
- [ ] In `.github/workflows/ci.yml`, keep the job id `ci` and change its `name` from `lint, typecheck, test, build, storybook` (line 11) to `ci`. Add top-level `permissions: contents: read`. Add top-level `concurrency` with `group: ci-${{ github.workflow }}-${{ github.ref }}` and `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. Pin `actions/checkout`, `pnpm/action-setup` and `actions/setup-node` to 40 character SHAs resolved with `gh api repos/<owner>/<repo>/commits/v4 --jq .sha`, each followed by a `# v4` comment.
- [ ] In `AGENTS.md`, rewrite the `### Git` list (starts at line 15). Keep the one ticket, one branch, one PR rule. Add that PR titles use `QVE-123: summary` (or `chore`, `docs`, `fix`, `ci`, `deps`), that the merge is a squash whose subject is the PR title and whose body is blank, that auto-merge is on once the required check `ci` is green, and that `main` is protected by a ruleset requiring a pull request, `ci`, linear history and no force push.
- [ ] In `docs/agents/issue-tracker.md`, add a `## Pull requests` section with the same five facts and a link to `.github/pull_request_template.md`. Leave the Linear project wording to PR-2.
- [ ] In `apps/web/src/test/github-workflow-config.test.ts`, read the three workflow and config files from the repo root and assert the contract in the unit step below.
- [ ] Out of scope for this diff. The root sets the repo options and the `main` ruleset with `gh api` after merge. Squash title `PR_TITLE`, squash message `BLANK`, auto-merge on, delete branch on merge kept, ruleset requiring a pull request with 0 approvals, the status check context `ci`, linear history, no force push and no deletion.

**You see.**

- [ ] `gh pr checks <n>` on this PR lists a check named exactly `ci` with `pass`, and a check named `pr-title` with `pass`.
- [ ] A scratch PR titled `update stuff` shows `pr-title` failing with the log line `PR title must match ^(QVE-[0-9]+|chore|docs|fix|ci|deps): .+`.
- [ ] A scratch PR retitled `chore: scratch workflow check` shows `pr-title` passing after the `edited` event.
- [ ] `gh api repos/<owner>/<repo>/contents/.github/dependabot.yml?ref=<head>` returns the file and the parsed YAML has the ecosystems `npm` and `github-actions`.
- [ ] `gh pr create --template .github/pull_request_template.md` opens a body containing the five headings.
- [ ] After the root's ops step, the ruleset names `ci` as the one required status check context.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/test/github-workflow-config.test.ts` gains four cases, red first at trunk, then green at head. The `ci.yml` job named `ci` has id `ci`. Every `uses:` line in `.github/workflows/*.yml` ends in a 40 character SHA. `ci.yml` declares `permissions` and `concurrency`. The pattern read from `pr-title.yml` accepts `QVE-12: add x`, `deps: bump y`, `fix: z` and rejects `update stuff`, `QVE-12:`, `feat: x`. Run `pnpm --filter web test -- github-workflow-config`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `gh run list --workflow ci.yml --branch main --limit 1 --json conclusion,name` at trunk and `gh pr checks` at head, then compare that the same lint, typecheck, build, storybook and test steps still run and still pass. Save `ci-regression.png` as evidence. Pass when the head `ci` run concludes success with the same step names as the trunk run and the web test summary still reads 478 passed, 1 skipped.
- [ ] Lane 2. Push a scratch branch from the head and open a scratch PR titled `update stuff` with `gh pr create`. Save `pr-title-fail.png` as evidence. Pass when `gh pr checks` shows `pr-title` as `fail` and `gh run view --log-failed` contains the pattern text.
- [ ] Lane 3. On the same scratch PR run `gh pr edit --title "QVE-999: scratch workflow check"`. Save `pr-title-pass.png` as evidence. Pass when a new `pr-title` run starts from the `edited` event and ends `pass`.
- [ ] Lane 4. Edit the scratch PR title to each of `fix:nospace`, `feat: x`, `QVE-1:` and `deps: bump y` in turn. Save `pr-title-matrix.png` as evidence. Pass when the first three fail and `deps: bump y` passes.
- [ ] Lane 5. Read the check run names for the head SHA with `gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[].name'`. Save `check-context.png` as evidence. Pass when the output contains the line `ci` exactly once and no longer name for the CI job.
- [ ] Lane 6. Read `.github/dependabot.yml` back with `gh api repos/<owner>/<repo>/contents/.github/dependabot.yml?ref=<head> --jq .content` and decode it, then parse it with `pnpm dlx js-yaml`. Save `dependabot-readback.png` as evidence. Pass when the JSON has `version` 2, an `npm` entry with `schedule.interval` `weekly` and a group covering `minor` and `patch`, and a `github-actions` entry with `schedule.interval` `monthly`.
- [ ] Lane 7. Open the scratch PR page in the browser per the boot recipe, signed in to GitHub, after creating it with `--template`. Save `template-rendered.png` as evidence. Pass when the PR body shows the headings Ticket, What and why, Verification evidence, Deploy impact and the title checkbox. If the browser is not signed in, save the `gh pr view --json body` output instead and record the gap.
- [ ] Lane 8. Push two commits to the scratch PR branch within ten seconds. Save `concurrency-cancel.png` as evidence. Pass when `gh run list --branch <scratch> --json status,conclusion` shows the first `ci` run `cancelled` and the second running or `success`.
- [ ] Lane 9. Open the setup log of the latest `ci` run with `gh run view <id> --log` and read the `GITHUB_TOKEN Permissions` block, then grep the three `uses:` lines. Save `permissions-and-pins.png` as evidence. Pass when the block lists only `Contents: read` and `Metadata: read` and each `uses:` line ends in a 40 character hex SHA.
- [ ] Lane 10. Audit lane. Read the diff of `AGENTS.md` and `docs/agents/issue-tracker.md` and grep both for `squash`, `PR title`, `blank`, `auto-merge`, `ruleset` and `ci`. Save `docs-grep.png` of the terminal. Pass when all six terms appear in both files and the diff touches no line outside the Git section and the new Pull requests section.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of the `ci` job in GitHub Actions, in seconds, at trunk and at head.
- [ ] Probe. Re-run the `ci` workflow three times on trunk and three times on the head branch, interleaved, and read `gh run view <id> --json jobs --jq '.jobs[] | select(.name=="ci") | (.completedAt, .startedAt)'` for each. Take the median per side.
- [ ] Baseline. Record the trunk median first.
- [ ] Rule. Head median must be within 15 percent of the trunk median. A larger gap fails.

**Review gate.** None. PR-1 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Rename OpenPath to OpenCV in code and docs (PR-2)

**Depends on.** None.

**Files.**

- [ ] Create `scripts/rename-opencv.mjs`, committed first and deleted in the last commit of the same PR.
- [ ] Create `docs/adr/0011-rename-to-opencv.md`.
- [ ] Edit `package.json`.
- [ ] Edit `packages/ui/src/lib/brand.ts`.
- [ ] Edit `packages/ui/src/foundations/type.stories.tsx`.
- [ ] Edit `apps/web/index.html`.
- [ ] Edit `apps/web/src/features/app-shell/app-logo.tsx`.
- [ ] Edit `apps/web/src/features/app-shell/app-sidebar.tsx`.
- [ ] Edit `apps/web/src/features/app-shell/search-modal.tsx`.
- [ ] Edit `apps/web/src/features/auth/auth-screen.tsx`.
- [ ] Edit `apps/web/src/features/pitch/pitch-types.ts`.
- [ ] Edit `apps/web/src/features/seed/sample-author.ts`.
- [ ] Edit `apps/web/src/features/paper/paper-cv-types.ts`.
- [ ] Edit `apps/web/src/features/paper/coach-float.tsx`.
- [ ] Edit `apps/web/src/features/paper/paper-editor.tsx`.
- [ ] Edit `apps/web/src/features/home/first-cafe-checklist.ts`.
- [ ] Edit `apps/web/src/features/home/aim-prompt.ts`.
- [ ] Edit `apps/web/src/features/apply/apply-types.ts`.
- [ ] Edit `packages/domain/src/starter.ts`.
- [ ] Edit `packages/domain/src/apply.ts`.
- [ ] Edit `apps/api/src/auth.ts`.
- [ ] Edit `apps/api/src/coach/prompt.ts`.
- [ ] Edit `apps/api/src/coach/title.ts`.
- [ ] Edit `apps/api/src/coach/runtime.ts`.
- [ ] Edit `apps/api/src/coach/smoke.ts`.
- [ ] Edit `apps/api/src/coach/eval/judge.ts`.
- [ ] Edit `apps/api/src/coach/eval/seed.ts`.
- [ ] Edit `apps/api/src/apply/fetch-posting.ts`.
- [ ] Edit `apps/api/src/origin.ts`.
- [ ] Edit `apps/api/src/db/schema.ts`.
- [ ] Edit the tests that assert these strings, `apps/web/src/routes/paper.test.tsx`, `apps/web/src/routes/app-shell.test.tsx`, `apps/web/src/test/paper-seam.test.ts`, `apps/web/src/test/thread-fixtures.ts`, `apps/web/src/features/paper/paper-data.test.ts`, `apps/web/src/features/pitch/pitch-api.test.ts`, `apps/web/src/features/pitch/pitch-types.test.ts`, `apps/web/src/features/pitch/pitch-workspace.test.tsx`, `apps/api/src/app.test.ts`, `apps/api/src/auth.test.ts`, `apps/api/src/config.test.ts`, `apps/api/src/coach/bind.test.ts`, `apps/api/src/coach/title.test.ts`, `apps/api/src/coach/tools.test.ts`, `apps/api/src/starter/content.test.ts`, `apps/api/src/test/harness.ts`.
- [ ] Edit `README.md`, `AGENTS.md`, `CONTEXT.md`, `PRODUCT.md`, `docs/agents/issue-tracker.md`, `.env.example`.

**Build.**

- [ ] Write `scripts/rename-opencv.mjs` as a codemod with an explicit replacement table and an explicit file allowlist, so a reviewer reruns it with `node scripts/rename-opencv.mjs` and gets an empty `git diff` the second time. The table maps `OpenPathLogo` to `OpenCvLogo`, `OpenPathMark` to `OpenCvMark`, `OpenPath` to `OpenCV`, `openpath:` to `opencv:`, `x-openpath-apply-card` to `x-opencv-apply-card`, `openpath.app` to `opencv.me`, `openpath-app.vercel.app` to `opencv.me`, and `openpath-dev` to `opencv-dev`. The script never touches `docs/specs`, `docs/research`, `docs/adr`, `apps/api/drizzle`, `pnpm-lock.yaml` or `node_modules`.
- [ ] Put the replacement table and the rerun command in the PR body. Delete `scripts/rename-opencv.mjs` in the final commit because it has no future use.
- [ ] Set `"name": "opencv"` in `package.json` line 2. No workspace package name changes.
- [ ] Set `brandName = "OpenCV"` in `packages/ui/src/lib/brand.ts` line 2 and the wordmark text in `packages/ui/src/foundations/type.stories.tsx` line 95.
- [ ] Rename `OpenPathMark` and `OpenPathLogo` in `apps/web/src/features/app-shell/app-logo.tsx` (lines 9 and 43) to `OpenCvMark` and `OpenCvLogo`, and update the three call sites at `auth-screen.tsx` lines 3 and 15, `app-sidebar.tsx` line 22, and `search-modal.tsx` lines 12 and 298.
- [ ] Set `<title>OpenCV</title>` in `apps/web/index.html` line 6.
- [ ] Set `STARTER_THREAD_TITLE = "Welcome to OpenCV"` in `packages/domain/src/starter.ts` line 25. Existing threads keep their stored title.
- [ ] Replace the product name in the prompt strings at `apps/api/src/coach/prompt.ts` line 79, `packages/domain/src/apply.ts` line 69, `apps/api/src/coach/title.ts` line 15 and `apps/api/src/coach/eval/judge.ts` line 24.
- [ ] Set `appName: "OpenCV"` in `apps/api/src/auth.ts` line 42. Set no `cookiePrefix`, so sessions survive.
- [ ] Set the OpenRouter `appName` to `"OpenCV"` and `appUrl` to `https://opencv.me` in `apps/api/src/coach/runtime.ts` lines 87 and 88, and the User-Agent to `OpenCV/1.0` in `apps/api/src/apply/fetch-posting.ts` line 124.
- [ ] Change the placeholder domain to `opencv.me/u/${slug}` in `apps/web/src/features/pitch/pitch-types.ts` line 83, and the sample email to `you@opencv.me` in `apps/web/src/features/seed/sample-author.ts` line 15. Change `linkedin.com/in/openpath-dev` to `linkedin.com/in/opencv-dev` in `paper-cv-types.ts` line 82.
- [ ] Rename the four localStorage prefixes to `opencv:paper:coach-float` (`coach-float.tsx` line 51), `opencv:paper:docs-panel` (`paper-editor.tsx` line 90), `opencv:home:first-cafe-checklist` (`first-cafe-checklist.ts` line 48) and `opencv:home:aim-prompt` (`aim-prompt.ts` line 7). Rename `APPLY_DRAG_TYPE` to `application/x-opencv-apply-card` in `apply-types.ts` line 19. Add no key migration, because the keys hold UI preferences only.
- [ ] Update the assertions in the listed tests in the same change. Fixture origins `openpath-app.vercel.app` become `opencv.me`, and the preview wildcard fixture `openpath-*-rickvudev.vercel.app` becomes `opencv-*-example.vercel.app`.
- [ ] Add one line above `export const openpathApp = pgSchema("openpath_app")` in `apps/api/src/db/schema.ts` line 23, a comment saying `openpath_app` is a historical schema name kept on purpose (ADR-0011). Leave `apps/api/drizzle` and `apps/api/src/db/migrate.test.ts` unchanged.
- [ ] Edit only the operational docs `README.md`, `AGENTS.md`, `CONTEXT.md`, `PRODUCT.md`, `docs/agents/issue-tracker.md` and `.env.example` (the `dev@openpath.app` seed email at line 51). Leave `docs/specs`, `docs/research` and `docs/adr` as historical records. Leave `docs/railway.md` and `docs/deploy.md` to PR-3. In `docs/agents/issue-tracker.md`, change the Linear project name to `OpenCV` only in the wording, and note that the root renames the Linear project in the same step as the merge.
- [ ] Create `docs/adr/0011-rename-to-opencv.md` with status, context, decision and consequences. Decision text states the product is OpenCV, the Postgres schema `openpath_app` stays as an internal id, Better Auth cookies keep their prefix, and the GitHub repo and Linear project are renamed by the operator.

**You see.**

- [ ] The sidebar wordmark, the sign-in logo and the search modal header read `OpenCV`, and the browser tab title is `OpenCV`.
- [ ] A fresh signup gets a first thread titled `Welcome to OpenCV`.
- [ ] A published pitch shows the label `opencv.me/u/<slug>`.
- [ ] `grep -rli openpath apps packages --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=storybook-static | grep -v drizzle | grep -v schema.ts | grep -v migrate.test.ts` prints nothing.
- [ ] `gh pr checks` shows `ci` as `pass`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] First edit the assertions in `apps/web/src/routes/paper.test.tsx`, `apps/web/src/test/paper-seam.test.ts`, `apps/web/src/routes/app-shell.test.tsx`, `apps/web/src/features/pitch/pitch-types.test.ts`, `apps/api/src/starter/content.test.ts` and `apps/api/src/coach/title.test.ts` to the new strings and see them fail at trunk code (red). Then run the codemod and see them pass (green). Run `pnpm --filter web test`, `pnpm --filter @workspace/domain test` and `pnpm --filter api test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Sign up a fresh user, open Home, create a thread and send one message at trunk and at head. Save `signup-regression.png` as evidence. Pass when both sides complete the same flow with no console error, trunk shows `OpenPath` branding and head shows `OpenCV` branding.
- [ ] Lane 2. Open `/app` signed in and read the sidebar wordmark. Save `sidebar-wordmark.png` as evidence. Pass when the sidebar logo text and its sr-only text equal `OpenCV` and no `OpenPath` text is in `document.body.innerText`.
- [ ] Lane 3. Read `document.title` on `/sign-in`, `/app` and a missing route via `agent-browser`. Save `tab-title.png` as evidence. Pass when all three equal `OpenCV`.
- [ ] Lane 4. Open `/sign-in` signed out. Save `signin-logo.png` as evidence. Pass when the auth screen logo reads `OpenCV`.
- [ ] Lane 5. Press Ctrl+K to open the search modal. Save `search-modal.png` as evidence. Pass when the modal header logo reads `OpenCV`.
- [ ] Lane 6. Fresh signup, then read the first thread title in the sidebar and in the thread header. Save `starter-thread.png` as evidence. Pass when the title is `Welcome to OpenCV`.
- [ ] Lane 7. Publish a pitch and open its public URL. Save `pitch-url.png` as evidence. Pass when the label reads `opencv.me/u/<slug>`, the page loads with HTTP 200, and no `openpath` text appears.
- [ ] Lane 8. Open a paper document, toggle the docs panel and drag the coach float, then run `Object.keys(localStorage)` in the page. Save `local-storage-keys.png` as evidence. Pass when the list contains `opencv:paper:docs-panel` and `opencv:paper:coach-float` and no key starts with `openpath:`.
- [ ] Lane 9. Open the Apply board and drag a card from one column to another, logging `dataTransfer.types` in a `dragstart` listener. Save `apply-drag.png` as evidence. Pass when the types include `application/x-opencv-apply-card` and the card lands in the target column.
- [ ] Lane 10. Audit lane. Run the grep from the "You see" list, then `git show HEAD --stat`, then `grep -n -B1 "openpath_app" apps/api/src/db/schema.ts` and `ls docs/adr/0011-rename-to-opencv.md`. Save `grep-sweep.png` of the terminal. Pass when the grep is empty, the comment sits directly above line 23's declaration, the ADR exists, `scripts/rename-opencv.mjs` is absent at the head, and `gh pr checks` shows `ci` as `pass`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Size in bytes of the main JS chunk in `apps/web/dist/assets`, and wall time of `pnpm --filter web test`, at trunk and at head.
- [ ] Probe. In one worktree per side, run `pnpm --filter web build` and `wc -c apps/web/dist/assets/index-*.js`, then `/usr/bin/time -f %e pnpm --filter web test`, three times each, interleaved trunk then head.
- [ ] Baseline. Record the trunk chunk size (about 1,207 kB) and the median test time first.
- [ ] Rule. Chunk size at head must be within 0.5 percent of trunk, and median web test time within 10 percent. A larger gap fails.

**Review gate.** None. PR-2 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Remove Storybook (PR-18)

**Depends on.** PR-1.

**Files.**

- [ ] Delete `packages/ui/.storybook/main.ts` and `packages/ui/.storybook/preview.ts`.
- [ ] Delete the 19 `*.stories.tsx` files under `packages/ui/src/components/` and the whole `packages/ui/src/foundations/` directory (its five files are all stories).
- [ ] Delete `packages/ui/vercel.json`.
- [ ] Delete `apps/web/src/test/storybook-catalog.test.ts`.
- [ ] Edit `packages/ui/package.json` (scripts at lines 10 and 11, dependencies at lines 27, 28, 29 and 38).
- [ ] Edit `package.json` (scripts at lines 12 and 13).
- [ ] Edit `turbo.json` (the `build-storybook` task at lines 27 to 29).
- [ ] Edit `.github/workflows/ci.yml` (the run line at line 31 and the step name at line 30).
- [ ] Edit `packages/ui/eslint.config.js` (lines 9 and 26).
- [ ] Edit `.gitignore` (line 42).
- [ ] Edit `apps/api/src/coach/eval/exclusion.test.ts` (line 22).
- [ ] Edit `README.md` (lines 14, 42 and 43 and the Storybook paragraph under Deployment).
- [ ] Edit `AGENTS.md` (the Design system section at line 27).
- [ ] Edit `docs/deploy.md` (delete the section from "Deploying Storybook to Vercel" to the end).
- [ ] Edit `pnpm-lock.yaml` by running `pnpm install`.
- [ ] Create `docs/adr/0013-remove-storybook.md`.

**Build.**

- [ ] Remove the `storybook` and `build-storybook` scripts and the four Storybook dev dependencies (`@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/react-vite`, `storybook`) from `packages/ui/package.json`, then run `pnpm install` so the lockfile drops them.
- [ ] Remove the root `storybook` and `build-storybook` scripts from `package.json` and the `build-storybook` task from `turbo.json`.
- [ ] Change the CI run line in `.github/workflows/ci.yml` to `pnpm turbo run lint typecheck build` and the step name to `lint, typecheck, build`.
- [ ] Remove `storybook-static` from `globalIgnores` and the `**/*.stories.tsx` glob from the files list in `packages/ui/src/eslint.config.js`, and remove `storybook-static` from `.gitignore`.
- [ ] Drop the `build-storybook` expectation at `apps/api/src/coach/eval/exclusion.test.ts` line 22 and keep the rest of that test.
- [ ] Keep the ADR-0010 governance. The vocabulary test that forbids raw hex and palette classes stays. If the built-CSS assertion lived only in the Storybook build, move it to a vitest in `packages/ui` that compiles `packages/ui/src/styles/globals.css` with the Tailwind Vite plugin and asserts the token names; the owner greps `packages/ui` and `apps/web/src/test` for the assertion first and records what it found in the PR body.
- [ ] Rewrite the Design system section of `AGENTS.md` so it no longer asks for colocated `*.stories.tsx` files or names a local catalog, and points at the vocabulary test as the governance.
- [ ] Shorten `README.md` to the two surfaces (web and api) and delete the Storybook deploy section from `docs/deploy.md`.
- [ ] Write `docs/adr/0013-remove-storybook.md` with status, context, decision and consequences. It supersedes the catalog part of ADR-0002 and the "Storybook's build joins CI" line of ADR-0010, and records that the kit stays as source in `packages/ui`.

**You see.**

- [ ] `git ls-files | grep -E "\.stories\.tsx$|^packages/ui/\.storybook/|^packages/ui/vercel\.json$"` prints nothing at the head.
- [ ] `pnpm ls -r --depth 0 2>/dev/null | grep -i storybook` prints nothing after `pnpm install --frozen-lockfile`.
- [ ] `pnpm turbo run lint typecheck build test` is green at the head, and the CI job `ci` shows no Storybook step.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/coach/eval/exclusion.test.ts` keeps its eval-exclusion cases and loses the `build-storybook` match. Run `pnpm --filter api test src/coach/eval/exclusion.test.ts`.
- [ ] The ADR-0010 vocabulary test still runs and still fails on a scratch `bg-red-500` added to `apps/web/src/routes/home.tsx` (red), then passes once the scratch line is removed (green). Run `pnpm --filter web test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm turbo run lint typecheck build test` at trunk and at head in two worktrees. Save `pr18-gates-trunk-head.png`. Pass when both runs exit 0 and the head run lists no `build-storybook` task.
- [ ] Lane 2. Clean install. In a fresh worktree at head run `pnpm install --frozen-lockfile` then `pnpm ls -r --depth 0 | grep -i storybook`. Save `pr18-install-clean.png`. Pass when the install exits 0 and the grep prints nothing.
- [ ] Lane 3. Tracked files. Run `git ls-files | grep -E "stories\.tsx|\.storybook|storybook-static|packages/ui/vercel\.json"` at head. Save `pr18-ls-files.png`. Pass when it prints nothing.
- [ ] Lane 4. Operational references. Run `grep -rn -i storybook package.json turbo.json .github README.md AGENTS.md docs/deploy.md packages/ui apps/web/src apps/api/src --exclude-dir=node_modules --exclude-dir=dist`. Save `pr18-grep-refs.png`. Pass when the only hits are inside `docs/adr/`.
- [ ] Lane 5. App surfaces still render. Sign up, then open `/app`, `/app/paper`, `/app/apply` and `/app/pitch` at head with the browser console open. Save `pr18-surfaces.png`. Pass when all four pages render their kit components with zero console errors.
- [ ] Lane 6. CI job shape. After the PR-facing push run `gh run view --job` on the head's `ci` job and list its steps. Save `pr18-ci-steps.png`. Pass when the steps are Checkout, Setup pnpm, Setup Node, Install, `lint, typecheck, build`, `test` and nothing names Storybook.
- [ ] Lane 7. Kit lint. Run `pnpm --filter @workspace/ui lint` and `pnpm --filter @workspace/ui typecheck` at head. Save `pr18-ui-lint.png`. Pass when both exit 0 with no unused-config warnings.
- [ ] Lane 8. Visual parity. Screenshot `/sign-in` and the Paper CV editor on the sample CV at trunk and at head at 1280 px and compare with a pixel diff. Save `pr18-parity.png`. Pass when the diff is zero pixels.
- [ ] Lane 9. Audit lane. Read the diff and list every deleted path. Save `pr18-audit-deletions.png`. Pass when every deleted file is a `*.stories.tsx`, a `.storybook` config, `packages/ui/vercel.json`, the catalog test, or Storybook-only doc text, and no file under `packages/ui/src/components` other than stories changed.
- [ ] Lane 10. Governance kept. Add a scratch `bg-red-500` class to `apps/web/src/routes/home.tsx` at head, run `pnpm --filter web test`, then revert. Save `pr18-governance-red.png`. Pass when the vocabulary test fails with the scratch line and passes after the revert.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of `pnpm install --frozen-lockfile` from an empty store and the size of `node_modules` (`du -sh node_modules`) at trunk and head.
- [ ] Probe. In two fresh worktrees run `pnpm store prune && time pnpm install --frozen-lockfile && du -sh node_modules`, trunk then head, then trunk then head again, and take the median of each.
- [ ] Baseline. Record the trunk install time and `node_modules` size first.
- [ ] Rule. Head `node_modules` is smaller than trunk and head install time is not more than trunk. A head that is larger or slower fails.

**Review gate.** None. PR-18 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Move hosting to Railway behind opencv.me (PR-3)

**Depends on.** PR-2 and PR-18.

**Files.**

- [ ] Create `apps/web/Dockerfile`.
- [ ] Create `apps/web/Caddyfile`.
- [ ] Create `.dockerignore`.
- [ ] Create `.railway/railway.ts`.
- [ ] Create `docs/adr/0012-hosting-on-railway.md`.
- [ ] Edit `docs/deploy.md`.
- [ ] Edit `docs/adr/0001-platform-and-stack.md`.
- [ ] Edit `apps/web/src/test/deploy-config.test.ts`.
- [ ] Edit `.env.example`.
- [ ] Edit `README.md`.
- [ ] Delete `railway.json`.
- [ ] Delete `vercel.json`.
- [ ] Delete `docs/railway.md`.
- [ ] Delete `docs/ops/qve-230-force-prod.md`.

**Build.**

- [ ] In `apps/web/Dockerfile`, write two stages. The first stage is `node:20-slim AS build`, enables pnpm through corepack, copies the repo, declares `ARG VITE_API_URL`, exports it as `ENV VITE_API_URL=$VITE_API_URL`, and runs `pnpm install --frozen-lockfile && pnpm turbo build --filter=web`. The second stage is `caddy:2-alpine`, copies `apps/web/dist` to `/srv` and `apps/web/Caddyfile` to `/etc/caddy/Caddyfile`, and starts `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile`.
- [ ] In `apps/web/Caddyfile`, set the global block `auto_https off`, a site block on `:{$PORT:8080}` with `root * /srv`, `encode gzip`, a `/health` handler that runs `respond "ok" 200`, and `try_files {path} /index.html` before `file_server`. Cache `/assets/*` as immutable and send `index.html` with `no-cache`.
- [ ] In `.dockerignore`, exclude `node_modules`, `**/dist`, `.git`, `.turbo`, `apps/api/.data` and `storybook-static` so the build context stays small.
- [ ] Generate the api half of `.railway/railway.ts` with `railway config migrate --apply --service api`. Choose `--variables unmanaged` so secrets stay in Railway. Keep the translated settings from `railway.json` lines 4 to 21, which are the build command, watch patterns, pre-deploy command `pnpm --filter api run migrate`, start command `pnpm --filter api run start`, healthcheck `/health` with a 120 second timeout, and restart policy `ON_FAILURE` with 10 retries.
- [ ] Extend `.railway/railway.ts` with a `web` service built from `apps/web/Dockerfile`, healthcheck `/health`, and watch paths `apps/web/**`, `packages/ui/**`, `packages/domain/**`, `pnpm-lock.yaml`. Set the web variable `VITE_API_URL` to `https://api.opencv.me` in production and `https://api-staging.opencv.me` in staging. Do not put `AUTH_URL` or `WEB_ORIGINS` in the file, because the cutover order flips them last by hand.
- [ ] Delete `railway.json`, `vercel.json`, `docs/railway.md` and `docs/ops/qve-230-force-prod.md`. Storybook is already gone after PR-18, so no catalog service exists on Railway.
- [ ] Rewrite `docs/deploy.md` as the single Railway deploy doc. It holds the service layout per environment (production `api`, `Postgres`, `web`, staging the same), the build and start settings, the variable table (production `AUTH_URL` `https://api.opencv.me`, `WEB_ORIGINS` `https://opencv.me` plus the Vercel origin during overlap, staging `AUTH_URL` `https://api-staging.opencv.me`, `WEB_ORIGINS` `https://staging.opencv.me,http://localhost:5173`), the domains and DNS table (`@` and `www` to web production, `api` to api production, `staging` to web staging, `api-staging` to api staging, plus the Railway TXT records, Cloudflare SSL mode Full, `api` and `api-staging` DNS-only so Coach SSE is not buffered), the cutover order, and the rollback. Carry over the useful parts of the old `docs/railway.md`, namely the coach variables, the migration pipeline and the legacy schema note.
- [ ] State the cutover order in `docs/deploy.md` as numbered steps. Migrate and cut over the api config before 2026-12-01, add domains and DNS and wait for the certificate, add the new origin to `WEB_ORIGINS` while keeping the old one, deploy web with the new `VITE_API_URL`, flip api `AUTH_URL` last (one forced re-login), keep `*.up.railway.app` and Vercel for one to two weeks, then set the GitHub homepage to `https://opencv.me`.
- [ ] State the rollback in `docs/deploy.md`. Point `AUTH_URL` back to the `*.up.railway.app` host, drop the new origin from `WEB_ORIGINS`, run `railway config migrate undo`, and re-enable the Vercel production deploy.
- [ ] Leave `apps/web/src/lib/api.ts` unchanged, its fallback stays localhost. Leave `apps/api/src/auth.ts` line 27 unchanged, `SameSite=None` stays during the overlap, and say so in the doc and the ADR.
- [ ] Create `docs/adr/0012-hosting-on-railway.md` that supersedes the hosting line of ADR-0001 (line 7). Add a one-line `Superseded in part by ADR-0012` note to `docs/adr/0001-platform-and-stack.md`.
- [ ] In `.env.example`, drop the Vercel wording at lines 2, 6 and 18, set `VITE_API_URL` guidance to the Railway web service, and remove the dead `DB_SCHEMA` line (line 30). In `README.md`, replace the Vercel deployment paragraph (lines 47 to 49) with a pointer to `docs/deploy.md`.
- [ ] In `apps/web/src/test/deploy-config.test.ts`, remove the `vercel.json` describe block. Keep the `.env.example` VITE_ coverage case. Add cases that read `apps/web/Caddyfile` and `apps/web/Dockerfile`.
- [ ] Ops steps run by the root after merge, not in this diff. Create the `web` services and variables, add custom domains, create the Cloudflare DNS records and TXT records, run `railway config migrate cutover`, flip `AUTH_URL`, set the GitHub homepage, rename the Railway project if wanted.

**You see.**

- [ ] `git ls-files railway.json vercel.json docs/railway.md` prints nothing at the head.
- [ ] `railway config plan --file .railway/railway.ts --environment staging` prints a plan that creates the `web` service and changes nothing on `api` other than the config source.
- [ ] After the ops steps, `curl -sI https://opencv.me` returns `HTTP/2 200`.
- [ ] After the ops steps, `curl https://api.opencv.me/health` returns HTTP 200.
- [ ] After the ops steps, sign-in works on `https://opencv.me` and the session cookie is set for `api.opencv.me`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/test/deploy-config.test.ts` loses the `vercel.json` case and gains three cases, red first at trunk and green at head. The `Caddyfile` contains `auto_https off`, `try_files {path} /index.html` and a `/health` handler. The `Dockerfile` declares `ARG VITE_API_URL` and runs `pnpm turbo build --filter=web`. The `.railway/railway.ts` text names the paths `apps/web/**`, `packages/ui/**`, `packages/domain/**` and `pnpm-lock.yaml`. Run `pnpm --filter web test -- deploy-config`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Build the web app and serve it with `pnpm --filter web preview` at trunk and at head, then load `/`, `/sign-in` and a deep link such as `/app`. Save `preview-regression.png` as evidence. Pass when both sides serve the same `index.html` for the three paths with HTTP 200 and the sign-in page renders.
- [ ] Lane 2. Docker is not available on this machine, so the lane runs the Caddy stage's equivalent. Run `pnpm turbo build --filter=web` with `VITE_API_URL=http://localhost:3999`, then `pnpm --filter web preview --port <web port>`. Save `preview-built-with-api-url.png` as evidence. Pass when the built bundle in `apps/web/dist/assets` contains the string `http://localhost:3999` and the app calls that host on sign-in in the network log.
- [ ] Lane 3. Run `command -v caddy`. If present, run `caddy validate --config apps/web/Caddyfile --adapter caddyfile`. If absent, record the gap and grep `apps/web/Caddyfile` for `auto_https off`, `try_files {path} /index.html`, `respond "ok" 200` and `file_server`. Save `caddyfile-validate.png` as evidence. Pass when `caddy validate` prints `Valid configuration`, or the gap is written down and all four directives are found.
- [ ] Lane 4. Read `apps/web/Dockerfile` line by line against a checklist. Save `dockerfile-audit.png` as evidence. Pass when it has exactly two `FROM` lines, `ARG VITE_API_URL` appears before the build `RUN`, the build command equals `pnpm install --frozen-lockfile && pnpm turbo build --filter=web`, and the final stage copies `apps/web/dist` and `apps/web/Caddyfile`.
- [ ] Lane 5. Run `railway config plan --file .railway/railway.ts --environment staging --json` (read-only, applies nothing). Save `railway-plan.png` as evidence. Pass when the command exits 0, the plan lists a `web` service with the four watch paths and `/health`, and the `api` service keeps the pre-deploy command `pnpm --filter api run migrate`.
- [ ] Lane 6. Run `railway config migrate status` and `node --check` on a copy of `.railway/railway.ts` renamed to `.mts` if the installed Node strips types. Save `iac-parse.png` as evidence. Pass when `status` lists `api` and `web` with no parse error, and `node --check` exits 0 or the unsupported-syntax gap is recorded.
- [ ] Lane 7. Render `docs/deploy.md` with a markdown preview in the browser and read the DNS table. Save `deploy-doc-dns.png` as evidence. Pass when the table has rows for `@`, `www`, `api`, `staging`, `api-staging` and the Railway TXT records, each with type, target, proxy mode and service, and `api` and `api-staging` read DNS-only.
- [ ] Lane 8. Read the cutover and rollback sections of `docs/deploy.md` against `/home/quan/tmp/opencv-audit/infra-rename.md` section 3. Save `cutover-order.png` as evidence. Pass when the cutover has five ordered steps with `AUTH_URL` flip fourth, the rollback names `railway config migrate undo`, and the deadline 2026-12-01 appears.
- [ ] Lane 9. Run `git diff --stat main...HEAD` and `git grep -n "vercel" -- . ':!docs/adr' ':!docs/specs' ':!docs/research' ':!pnpm-lock.yaml'`. Save `leftover-vercel.png` as evidence. Pass when the deleted files are exactly the five listed, `apps/api/src/auth.ts` and `apps/web/src/lib/api.ts` are absent from the diff, and every remaining `vercel` hit sits in the overlap and rollback text of `docs/deploy.md`, in a `WEB_ORIGINS` example, or in a code comment about previews.
- [ ] Lane 10. Run `gh pr checks` on the PR and `pnpm turbo run lint typecheck build test`. Save `ci-and-local.png` as evidence. Pass when `ci` is `pass` and the local run exits 0 with web tests passing, including the updated `deploy-config` cases.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time in seconds of an uncached `pnpm turbo build --filter=web --force` and the total bytes of `apps/web/dist`, at trunk and at head.
- [ ] Probe. In one worktree per side, run `/usr/bin/time -f %e pnpm turbo build --filter=web --force` and `du -sb apps/web/dist`, three times each, interleaved trunk then head. The Caddy and Railway pieces add nothing to this build, so the probe guards the build path the Dockerfile reuses.
- [ ] Baseline. Record the trunk median build time and dist bytes first.
- [ ] Rule. Head median build time within 10 percent of trunk and dist bytes within 1 percent. A larger gap fails.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 7 and lane 8 screenshots into `/home/quan/tmp/opencv-review/PR-3-review-deploy-doc.png` and `/home/quan/tmp/opencv-review/PR-3-review-cutover-order.png`.
- [ ] Record a 30 to 60 second video of the change on a lane worktree. Save it as `/home/quan/tmp/opencv-review/PR-3-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
## Fix the api test timeouts at the root (PR-4)

**Depends on.** None.

**Files.**

- [ ] Edit `apps/api/src/test/harness.ts`.
- [ ] Create `apps/api/src/test/global-setup.ts`.
- [ ] Create `apps/api/src/test/harness.test.ts`.
- [ ] Edit `apps/api/vitest.config.ts`.
- [ ] Edit `apps/api/src/apply/http.test.ts`.
- [ ] Edit `apps/api/src/coach/http.test.ts`.
- [ ] Edit `apps/api/src/commands/profile.test.ts`.
- [ ] Edit `apps/api/src/coach/bind.test.ts`.

**Build.**

- [ ] In `apps/api/src/test/global-setup.ts`, export a default `setup(project)` that builds one `PGlite`, runs the drizzle `migrate` against `migrationsFolder`, writes `await client.dumpDataDir("none")` to a file under `os.tmpdir()`, calls `project.provide("pgliteTemplatePath", path)`, and returns a teardown that deletes the file. Declare `pgliteTemplatePath` in vitest `ProvidedContext` in the same file.
- [ ] In `apps/api/vitest.config.ts`, add `globalSetup: ["./src/test/global-setup.ts"]` to the `test` block (currently lines 3-12 hold only `exclude`).
- [ ] In `apps/api/src/test/harness.ts`, change `createMigratedTestDb` (lines 24-29) to read the dump with `inject("pgliteTemplatePath")` and return `new PGlite({ loadDataDir: new Blob([bytes]) })` wrapped by `drizzle`. If `inject` yields nothing (a script run outside vitest), keep the old full `migrate` path so the function still works everywhere.
- [ ] In `apps/api/src/apply/http.test.ts`, add one file-level `beforeAll` (60_000 ms) that creates one shared db, then replace the five inline `await createMigratedTestDb()` calls at lines 350, 396, 436, 486 and 514 with `createTestApp(sharedDb, {...})`. Give each test its own signed-up user email so rows do not collide. Close the shared client once in `afterAll`.
- [ ] In `apps/api/src/coach/http.test.ts` line 730 (the `curl -N` case), `apps/api/src/commands/profile.test.ts` line 107 and `apps/api/src/coach/bind.test.ts` line 45, move the inline `createMigratedTestDb()` into a `beforeAll` for the enclosing `describe` and reuse that db.
- [ ] Add `testTimeout: 15_000` to `apps/api/vitest.config.ts` only if the slowest test on a one-core run still exceeds 4,000 ms after the changes above. Record the measured slowest test in the PR body. If none exceeds 4,000 ms, add nothing.
- [ ] In `apps/api/src/test/harness.test.ts`, add one case that times three calls to `createMigratedTestDb()` and expects the median under 1,500 ms, plus one case that inserts a row in one returned db and expects another returned db to be empty.

**You see.**

- [ ] `pnpm --filter api test` prints `Test Files` and `Tests` with zero failures and zero lines matching `Test timed out in 5000ms`.
- [ ] `pnpm --filter api test src/apply/http.test.ts` finishes the 14 cases of that file in under 15 s, down from the 26.8 s measured with `--testTimeout=30000` at trunk.
- [ ] `git diff --stat` shows the five inline calls in `apply/http.test.ts` gone, and `grep -c "createMigratedTestDb()" apps/api/src/apply/http.test.ts` prints `1` or `2`, which are the shared `beforeAll` sites only.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/test/harness.test.ts` gains the clone-speed case. Red first at trunk, where one call takes 2.5 to 4.4 s and the median exceeds 1,500 ms. Green after the dump and load change. Run `pnpm --filter api test src/test/harness.test.ts`.
- [ ] `apps/api/src/test/harness.test.ts` gains the isolation case (a row inserted through one db is absent in a second db). Run `pnpm --filter api test src/test/harness.test.ts`.
- [ ] The five `apply/http.test.ts` cases (QVE-232, QVE-251, QVE-249 and the two "without a scan runtime" cases) fail at trunk under the default 5,000 ms and pass at head with no timeout flag. Run `pnpm --filter api test src/apply/http.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm --filter api test src/apply/http.test.ts` at trunk and at head on the same machine with no timeout flag. Save `pr4-regression.png`. Pass when trunk prints 5 `Test timed out in 5000ms` failures and head prints 14 passed with 0 failed.
- [ ] Lane 2. Run `pnpm --filter api test` at head, full suite, default config. Save `pr4-full-suite.png`. Pass when the summary shows 0 failed, 0 timeouts, and the 384 trunk-passing cases still pass (count at head is at least 384 plus the 2 new harness cases).
- [ ] Lane 3. Slow-box simulation. Run `taskset -c 0 pnpm --filter api test` at head. Save `pr4-one-core.png`. Pass when 0 tests time out and the slowest test reported by `--reporter=verbose` is under 4,000 ms.
- [ ] Lane 4. Repeat flake check. Run `pnpm --filter api test src/apply/http.test.ts src/coach/bind.test.ts src/commands/profile.test.ts` five times in a shell loop at head. Save `pr4-repeat.png`. Pass when all five runs end with 0 failed.
- [ ] Lane 5. Isolation check by order. Run `pnpm --filter api test --sequence.shuffle` twice at head. Save `pr4-shuffle.png`. Pass when both runs end with 0 failed, which shows the shared db tests do not depend on order.
- [ ] Lane 6. Drive the real api with curl on a harness db. Write a driver under `~/tmp` that calls `createMigratedTestDb()` from the head `harness.ts` outside vitest, mounts `createApp`, and listens on a free port. Run `curl -s localhost:<port>/health`, sign up through `/api/auth/sign-up/email`, then `curl` `/api/session` with the cookie. Save `pr4-curl-harness-db.png`. Pass when health is 200 and `/api/session` prints `"ok":true` for the new user, which proves the fallback migrate path works outside vitest.
- [ ] Lane 7. Drive the clone path with curl. Run the same driver inside a one-file vitest run that holds the server open for 20 s (a `~/tmp` test file), and `curl` sign up then `GET /api/threads` with the cookie. Save `pr4-curl-cloned-db.png`. Pass when `GET /api/threads` returns `"ok":true` with the starter thread titled `Welcome to OpenPath`, which proves a cloned db carries the migrated schema and starter seed.
- [ ] Lane 8. Fail-fast check. Temporarily corrupt one SQL file copy in a scratch worktree, then run `pnpm --filter api test src/test/harness.test.ts`. Save `pr4-bad-migration.png`. Pass when the run fails once in global setup with the migration error and does not print 32 separate migration failures.
- [ ] Lane 9. Cleanup check. Run `pnpm --filter api test` then `ls $(node -p "require('os').tmpdir()") | grep -i pglite`. Save `pr4-teardown.png`. Pass when no template dump file is left behind after the run.
- [ ] Lane 10. Static gates. Run `pnpm --filter api typecheck` and `pnpm --filter api lint`. Save `pr4-static.png`. Pass when typecheck exits 0 and lint adds no new warning over the baseline (the 2 baseline warnings are in the web app, none in the api).

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of one full `pnpm --filter api test` run, in seconds.
- [ ] Probe. Run `/usr/bin/time -f %e pnpm --filter api test` three times at trunk and three times at head, interleaved (trunk, head, trunk, head, trunk, head), each in its own worktree with warm `node_modules`. Both sides print the metric.
- [ ] Baseline. Record the trunk median first. The audit measured about 116 s at d722d6b.
- [ ] Rule. Head median must be at most 70 s and at most 60 percent of the trunk median. Fail if any head run has a failed or timed-out test.

**Review gate.** None. PR-4 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Harden the Apply scan URL guard and auth logging (PR-5)

**Depends on.** PR-16.

**Files.**

- [ ] Edit `apps/api/src/apply/fetch-posting.ts`.
- [ ] Create `apps/api/src/apply/fetch-posting.test.ts`.
- [ ] Edit `apps/api/src/auth.ts`.
- [ ] Edit `apps/api/src/auth.test.ts`.
- [ ] Edit `apps/api/src/coach/runtime.ts`.
- [ ] Edit `apps/api/src/coach/runtime.test.ts`.
- [ ] Edit `apps/api/src/coach/bind.ts`.
- [ ] Edit `apps/api/src/index.ts`.

**Build.**

- [ ] In `apps/api/src/apply/fetch-posting.ts`, change `isBlockedApplyScanHost` (line 44 calls it, defined near line 49) so `isPrivateIPv6(h)` runs only when `net.isIPv6(h)` is true. `fda.gov`, `fdic.gov` and `fcbarcelona.com` stop matching the `startsWith("fc")` and `startsWith("fd")` tests in `isPrivateIPv6`.
- [ ] In the same file, replace `hostFromHttpUrl` (lines 63-67) with `new URL(openable).hostname`, stripping port, userinfo and IPv6 brackets. Return `null` when parsing throws. `assertPublicApplyScanUrl` then blocks `http://user@127.0.0.1/x` and `http://localhost:3000/x`, and passes `https://example.com:8443/jobs` to `dns.lookup("example.com")`.
- [ ] In `createFetchJobPosting`, move the `await response.arrayBuffer()` (line 149) inside a `try`, read `response.body` as a stream, stop and cancel at `FETCH_MAX_BYTES`, and return `{ ok: false, message: APPLY_SCAN_FETCH_FAILED }` on any read error or timeout. Check `content-length` first and reject early when it exceeds the cap.
- [ ] In `apps/api/src/auth.ts`, gate the two `console.log` calls (line 54 password reset, line 59 verify email) on `process.env.NODE_ENV !== "production"`, read once at the top of `createAuth`. In production they log nothing and the `url` token is never written.
- [ ] In `apps/api/src/coach/runtime.ts`, add `scanModel?: string` to `OpenRouterCoachRuntimeOptions` (line 62), default it to `resolveCoachModel("free")` in the destructure next to `titleModel` (line 79), and use `openrouter(scanModel)` in `scanJobPosting` (line 103).
- [ ] In `apps/api/src/coach/bind.ts`, add `scanModel?: string` to `CoachRuntimeConfig` and pass it to `createOpenRouterCoachRuntime`. In `apps/api/src/index.ts`, pass `scanModel: coachModels.free` next to `titleModel: coachModels.light` (line 47).
- [ ] Work red first. Each of the four cases below is written and seen failing before the matching fix lands. PR-16's guard verification must be green at head, where it is red at trunk.

**You see.**

- [ ] `assertPublicApplyScanUrl("https://fda.gov/jobs/1")` returns `{ ok: true, url: "https://fda.gov/jobs/1" }`, where trunk returns `ok:false` with `Couldn't read that posting. Paste the job text and scan again.`
- [ ] `assertPublicApplyScanUrl("http://user@127.0.0.1/x")` and `"http://localhost:3000/x"` both return `ok:false`.
- [ ] With `NODE_ENV=production`, signing up and requesting a password reset prints no line starting `[auth] password reset for`. With `NODE_ENV=development` it still prints that line.
- [ ] With `COACH_MODEL_FREE=openai/test-free` set, the OpenRouter call made by Apply scan uses `openai/test-free`, which the unit case captures on the injected model argument.
- [ ] Railway check after deploy. The api service has `NODE_ENV=production`; if it does not, set it in the same ops step, or reset links still reach the logs.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/apply/fetch-posting.test.ts` (new) case `allows fda.gov, fdic.gov and fcbarcelona.com` expects `isBlockedApplyScanHost` false for each. Red at trunk (all three true), green after the `isIPv6` gate. Run `pnpm --filter api test src/apply/fetch-posting.test.ts`.
- [ ] Same file, case `blocks userinfo and port shapes` expects `assertPublicApplyScanUrl` `ok:false` for `http://user@127.0.0.1/x`, `http://localhost:3000/x`, `http://[::1]:8080/x`, and expects a lookup spy to receive `example.com` (not `example.com:8443`) for `https://example.com:8443/jobs`. Red first, then green. Run `pnpm --filter api test src/apply/fetch-posting.test.ts`.
- [ ] Same file, case `returns the fetch-failed result when the body read aborts` uses a `fetchImpl` whose body stream errors mid-read and expects `{ ok: false }` with no thrown error, plus case `stops reading at 512 KB` with a 2 MB stream and expects `ok:false` and a cancelled stream. Red first (unhandled rejection, full read), then green. Run `pnpm --filter api test src/apply/fetch-posting.test.ts`.
- [ ] `apps/api/src/auth.test.ts` gains `does not log reset or verify URLs in production` (stub `NODE_ENV` to `production`, spy on `console.log`, trigger `sendResetPassword`, expect no call) and the inverse case for non-production. Red first, then green. Run `pnpm --filter api test src/auth.test.ts`.
- [ ] `apps/api/src/coach/runtime.test.ts` gains `uses scanModel for scanJobPosting` and `defaults scanModel to the free-mode default`. Red first because `scanModel` does not exist at trunk. Run `pnpm --filter api test src/coach/runtime.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Start the api from a `~/tmp` PGlite driver that builds `createTestApp(db, { coach: createDemoCoachRuntime(), fetchJobPosting: createFetchJobPosting({ fetchImpl: stub, lookupImpl: stubPublicIp }) })`, sign up with curl, then `curl -s -X POST /api/apply/scan` with body `{"url":"https://fda.gov/jobs/1"}` at trunk and head. Save `pr5-fda-regression.png`. Pass when trunk answers with the message `Couldn't read that posting. Paste the job text and scan again.` and the stub fetch counter is 0, and head's stub fetch counter is 1 for host `fda.gov` with a response that is not that message.
- [ ] Lane 2. Web UI, Apply scan with `fda.gov`. With the api from lane 1 and the web per the boot recipe, use the `agent-browser` skill to sign up, open `/apply`, paste `https://fda.gov/jobs/1` into the scan field and submit. Save `pr5-ui-fda-scan.png`. Pass when the screenshot shows no `Couldn't read that posting` message and the scan state is a result or the not-found copy `Couldn't find a title or company in that post.`
- [ ] Lane 3. Web UI, private target stays refused. In the same browser session paste `http://user@127.0.0.1/x` into the Apply scan field and submit. Save `pr5-ui-userinfo-blocked.png`. Pass when the screenshot shows `Couldn't read that posting. Paste the job text and scan again.` and the stub fetch counter stays unchanged.
- [ ] Lane 4. Curl matrix of blocked shapes. Post these urls one by one to `/api/apply/scan` and list the urls in the screenshot. They are `http://localhost:3000/x`, `http://[::1]/x`, `http://169.254.169.254/latest`, `http://user@10.0.0.5/x`, `http://fd00::1/x`. Save `pr5-blocked-matrix.png`. Pass when every response is the fetch-failed message and the stub fetch counter is 0 for all five.
- [ ] Lane 5. Curl matrix of allowed shapes. Post `https://fdic.gov/careers/1`, `https://fcbarcelona.com/jobs`, `https://example.com:8443/jobs` with the stub lookup returning `93.184.216.34`. Save `pr5-allowed-matrix.png`. Pass when all three reach the stub fetch (counter is 3) and the lookup spy saw the bare hostnames with no `:8443`.
- [ ] Lane 6. Body read failure over HTTP. Point the stub `fetchImpl` at a body that throws after 10 KB, then `curl -i -X POST /api/apply/scan` with a public url. Save `pr5-body-abort.png`. Pass when the status is 200 or 4xx with an `ok:false` envelope carrying the fetch-failed message, never a 500 and never plain text.
- [ ] Lane 7. Oversize body over HTTP. Stub a 3 MB response and post a public url. Save `pr5-oversize.png`. Pass when the response is the fetch-failed envelope and the driver log shows the stream cancelled before 1 MB was read.
- [ ] Lane 8. Auth log gating in production mode. Start the driver with `NODE_ENV=production`, sign up, call `POST /api/auth/request-password-reset` with curl, and `grep "password reset for"` on the server log. Save `pr5-auth-log-prod.png`. Pass when grep finds 0 lines. Then restart with `NODE_ENV=development`, repeat, and Pass when grep finds 1 line.
- [ ] Lane 9. Scan model env. Start the driver using the real `createOpenRouterCoachRuntime` with a stub `fetch` (via the AI SDK provider `fetch` option or a local mock OpenRouter server) and `COACH_MODEL_FREE=openai/test-free`, then post a labeled JD to `/api/apply/scan`. Save `pr5-scan-model.png`. Pass when the captured OpenRouter request body has `"model":"openai/test-free"` at head and `"model":"openrouter/free"` at trunk.
- [ ] Lane 10. PR-16 guard verification and static gates. Run the PR-16 guard verification at trunk and at head, then `pnpm --filter api typecheck` and `pnpm --filter api test src/apply src/auth.test.ts src/coach/runtime.test.ts`. Save `pr5-guard-skill.png`. Pass when the guard verification is red at trunk and green at head, typecheck exits 0 and the listed tests pass.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Peak RSS in MB and elapsed ms for `createFetchJobPosting` to reject a 64 MB response body.
- [ ] Probe. A `~/tmp` script builds `createFetchJobPosting({ fetchImpl, lookupImpl })` with a `fetchImpl` returning a 64 MB streamed body, calls it once per process, and prints RSS from `process.memoryUsage().rss` and elapsed time. Run it five times at trunk and five at head, interleaved. Both sides produce the metric.
- [ ] Baseline. Record the trunk median RSS and elapsed time first. Trunk buffers the full body through `arrayBuffer()`.
- [ ] Rule. Head median RSS must be at most 50 percent of trunk's and head median elapsed time must not exceed trunk's. Fail otherwise.

**Review gate.** None. PR-5 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Collapse the api auth guard and error envelope into middleware (PR-6)

**Depends on.** PR-4.

**Files.**

- [ ] Create `apps/api/src/middleware.ts`.
- [ ] Create `apps/api/src/middleware.test.ts`.
- [ ] Edit `apps/api/src/app.ts`.
- [ ] Edit `packages/domain/src/envelope.ts`.
- [ ] Edit `apps/api/src/threads/http.ts`.
- [ ] Edit `apps/api/src/commands/http.ts`.
- [ ] Edit `apps/api/src/commands/registry.ts`.
- [ ] Edit `apps/api/src/apply/http.ts`.
- [ ] Edit `apps/api/src/paper/http.ts`.
- [ ] Edit `apps/api/src/pitch/http.ts`.
- [ ] Edit `apps/api/src/profile/http.ts`.
- [ ] Edit `apps/api/src/coach/http.ts`.
- [ ] Edit `apps/api/src/coach/reads.ts`.

**Build.**

- [ ] In `apps/api/src/middleware.ts`, export `requireSession(auth, db)`, a Hono `MiddlewareHandler` that returns `authUnavailableEnvelope()` with 503 when `auth` or `db` is missing, calls `readSession(auth, c)`, returns `unauthorizedEnvelope()` with 401 when there is no session, and otherwise sets `c.set("userId", session.user.id)` and calls `next()`. Declare the `userId` variable type in the same file.
- [ ] In the same file, export `handleApiError(error, c)` used by `app.onError`. A `CommandError` becomes `jsonWithStatus(c, errorEnvelope(error.code, error.message), error.status)`. Any other error is logged with `console.error` and becomes `errorEnvelope(ERROR_CODES.INTERNAL_ERROR, "Something went wrong")` with `httpStatusForError`. Add `INTERNAL_ERROR` to `ERROR_CODES` and a `500` case to `httpStatusForError` in `packages/domain/src/envelope.ts` (lines 1-11 and 63-79), because no 500 code exists at trunk. The not-found envelope reuses `ERROR_CODES.NOT_FOUND`. Export `notFoundEnvelopeResponse(c)` for `app.notFound`, an `{ok:false,error}` body with status 404.
- [ ] In `apps/api/src/app.ts`, register `app.onError(handleApiError)` and `app.notFound(notFoundEnvelopeResponse)` once, and replace the hard-coded `503` and `401` in the `/api/session` handler (lines 95-105) with `requireSession`-compatible calls that keep the `{ok:true,user,session}` success body unchanged.
- [ ] Replace the 13 pasted session guard blocks (the `!auth || !db` 503 followed by `readSession` and the 401) with `routes.use(requireSession(auth, db))` or per-route `requireSession` at these sites, taking `userId` from `c.var`. The sites are `threads/http.ts` lines 33 and 66, `commands/http.ts` line 27, `apply/http.ts` lines 35, 75 and 89, `paper/http.ts` lines 28 and 42, `pitch/http.ts` line 26, `profile/http.ts` line 25, and `coach/http.ts` lines 89, 253 and 321.
- [ ] Leave `pitch/http.ts` line 52 (`GET /public/:slug`) as is. It checks only `!db` and has no session, so it is not one of the 13.
- [ ] In `coach/http.ts` line 88 (`POST /:id/coach`), keep the `!coach` 503 check ahead of the session check by registering a small `requireCoach(coach)` middleware before `requireSession`. Trunk answers 503 `COACH_UNAVAILABLE` to a signed-out caller when no runtime is wired, and head must do the same.
- [ ] Delete the per-handler `catch` blocks that test `error instanceof CommandError` and rethrow otherwise, where the new `onError` covers them. The sites are `commands/registry.ts` lines 146 and 164, `apply/http.ts` line 111, `paper/http.ts` line 64, `coach/http.ts` lines 142, 163, 309 and 377, `threads/http.ts` line 88, `coach/reads.ts` line 98, `profile/http.ts` line 38, `pitch/http.ts` lines 39 and 66. Where a block does extra work before rethrowing, keep that work and drop only the envelope mapping. Read each block before deleting it.
- [ ] Do not change any route path, status code, envelope shape or SSE behavior. The PR must remove more lines than it adds; the PR body states `git diff --shortstat`.

**You see.**

- [ ] `curl -i localhost:<port>/api/nope` prints `HTTP/1.1 404` with `content-type: application/json` and a body of the form `{"ok":false,"error":{"code":...,"message":...}}`, where trunk prints the Hono plain text `404 Not Found`.
- [ ] A handler that throws a plain `Error` returns `500` with the `{"ok":false,"error":{...}}` envelope and logs the stack once on the server, not plain text.
- [ ] `curl -i localhost:<port>/api/threads` with no cookie prints `HTTP/1.1 401` and the same `unauthorizedEnvelope` body as trunk.
- [ ] `git diff --shortstat main...HEAD` prints more deletions than insertions, and `grep -rn "instanceof CommandError" apps/api/src --include=http.ts` prints at most one match.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/middleware.test.ts` (new) cases `requireSession returns 503 without auth or db`, `returns 401 without a session`, `sets userId and calls next with a session`. Red first because the module does not exist. Run `pnpm --filter api test src/middleware.test.ts`.
- [ ] Same file, cases `onError maps CommandError to its status and code`, `onError turns an unknown throw into a 500 envelope`, `notFound returns a 404 envelope`. Red first at trunk behavior (plain text). Run `pnpm --filter api test src/middleware.test.ts`.
- [ ] Existing route suites stay green and unedited in expectations. Run `pnpm --filter api test src/threads src/commands src/apply src/paper src/pitch src/profile src/coach/http.test.ts src/app.test.ts`. Add to `apps/api/src/coach/http.test.ts` one case, `signed-out caller gets 503 COACH_UNAVAILABLE when no runtime is wired`, which passes at trunk and at head. Run `pnpm --filter api test src/coach/http.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Start the PGlite api, then run one script of 12 curls at trunk and head (health, session signed out, sign up, session signed in, `GET /api/threads`, `GET /api/threads/:id`, `GET /api/profile`, `GET /api/paper`, `GET /api/apply`, `POST /api/commands` with a bad body, `GET /api/pitch/public/none`, `POST /api/threads/:id/coach` signed out). Save `pr6-regression.png`. Pass when status code and JSON body match between trunk and head for every call except the intended 404 and 500 cases, which are not in this list.
- [ ] Lane 2. Unknown API route over HTTP. `curl -i /api/nope`, `curl -i -X POST /api/threads/none/nope`. Save `pr6-notfound-curl.png`. Pass when both print 404 with `content-type: application/json` and `"ok":false`, and trunk prints plain text.
- [ ] Lane 3. Web UI, unknown route on the api. With the web per the boot recipe, use the `agent-browser` skill to open `http://localhost:<api port>/api/nope` in a tab. Save `pr6-ui-notfound.png`. Pass when the page shows the JSON envelope with `"ok":false` and a 404 message, and not the text `404 Not Found`.
- [ ] Lane 4. Web UI, signed-out guard. In `agent-browser`, clear cookies and open the web app at `/`. Save `pr6-ui-signed-out.png`. Pass when the app shows the sign-in screen with no error toast and the network log shows `/api/session` answering 401 with the envelope.
- [ ] Lane 5. Web UI, signed-in happy path. Sign up in the browser, open the Welcome thread, open `/apply` and `/paper`. Save `pr6-ui-signed-in.png`. Pass when the thread list, the Apply board and the Paper list render with no error state, and every `/api/*` call in the network log is 200.
- [ ] Lane 6. Guard on every converted site. Drive each of the 13 routes signed out with curl (a table in the screenshot). Save `pr6-guard-matrix.png`. Pass when all 13 answer 401 with `unauthorizedEnvelope`, and the same table with the driver started without a database answers 503 `authUnavailableEnvelope` for all 13.
- [ ] Lane 7. Coach order check. Start the driver without a coach runtime, then `curl -i -X POST /api/threads/<id>/coach` signed out. Save `pr6-coach-order.png`. Pass when the answer is 503 with the `COACH_UNAVAILABLE` code (same as trunk), and with a runtime wired the same call answers 401.
- [ ] Lane 8. Command error mapping. `POST /api/commands` with a command that fails its precondition (for example editing a Paper doc id that another user owns), as user A against user B's id. Save `pr6-command-error.png`. Pass when the response has the same HTTP status and `error.code` at trunk and head.
- [ ] Lane 9. Thrown error path. Run a `~/tmp` driver that mounts an extra route throwing `new Error("boom")` on the head app. Save `pr6-onerror.png`. Pass when `curl -i` prints 500 with the JSON envelope, the server log has one `boom` stack, and the body does not contain `boom` or a stack trace.
- [ ] Lane 10. Line count and static gates. Run `git diff --shortstat main...HEAD`, `pnpm --filter api typecheck`, `pnpm --filter api lint`. Save `pr6-diffstat.png`. Pass when deletions exceed insertions, typecheck exits 0, and lint adds no warning.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Request p50 in ms for `GET /api/threads` with a valid session cookie over 200 requests, plus total api source lines in the touched files.
- [ ] Probe. Start the PGlite api at trunk and at head, sign up once, then run `for i in $(seq 200)` curls with `-w "%{time_total}\n"` and compute the median. Interleave trunk and head across three rounds. Both sides produce the metric.
- [ ] Baseline. Record the trunk p50 first, and `wc -l` over the 11 touched route files.
- [ ] Rule. Head p50 must be within 10 percent of trunk's, and the touched route files must be at least 150 lines shorter at head. Fail otherwise.

**Review gate.** None. PR-6 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Remove the deprecated single-model Coach path (PR-7)

**Depends on.** PR-6.

**Files.**

- [ ] Edit `apps/api/src/config.ts`.
- [ ] Edit `apps/api/src/config.test.ts`.
- [ ] Edit `apps/api/src/app.ts`.
- [ ] Edit `apps/api/src/coach/http.ts`.
- [ ] Edit `apps/api/src/index.ts`.
- [ ] Edit `apps/api/src/coach/bind.ts`.
- [ ] Edit `apps/api/src/coach/bind.test.ts`.
- [ ] Edit `apps/api/src/coach/runtime.ts`.
- [ ] Edit `apps/api/src/coach/fake.ts`.
- [ ] Edit `apps/api/src/coach/domain.test.ts`.
- [ ] Edit `apps/api/src/coach/deploy-docs.test.ts`.
- [ ] Edit `apps/api/src/coach/eval/report.test.ts`.
- [ ] Edit `apps/api/src/test/harness.ts`.
- [ ] Edit `packages/domain/src/coach.ts`.
- [ ] Edit `docs/railway.md`.
- [ ] Edit `.env.example`.

**Build.**

- [ ] Migrate callers first, delete second, all in this one wave. In `packages/domain/src/coach.ts`, make `resolveCoachModel(mode, env)` take a required `CoachMode`, delete the `if (!mode)` branch that reads `COACH_MODEL` (lines near 66-68), delete `COACH_MODEL` from `CoachModelEnv` (line 40-41), delete `COACH_DAILY_TURN_LIMIT` from `CoachDailyTurnLimitEnv`, delete the global-cap step in `resolveCoachDailyTurnLimit` so only the per-mode env then the mode default apply, and delete `DEFAULT_COACH_MODEL` (lines 13-14) and `DEFAULT_COACH_DAILY_TURN_LIMIT`. Keep `DEFAULT_COACH_MODELS` and `DEFAULT_COACH_DAILY_TURN_LIMITS`.
- [ ] In `apps/api/src/config.ts`, delete `coachModelFromEnv` (lines 69-75) and `coachDailyTurnLimitFromEnv` (lines 86-100) and the now unused `DEFAULT_COACH_DAILY_TURN_LIMIT` import at line 2.
- [ ] In `apps/api/src/app.ts`, delete `coachModel` and `coachDailyTurnLimit` from the options type (lines 41-45), the destructure (line 62) and the `createCoachRoutes` call (line 124).
- [ ] In `apps/api/src/coach/http.ts`, delete `coachModel` and `coachDailyTurnLimit` from `CoachRouteOptions` (line 67) and the destructure (line 80). Reduce lines 179-186 to `const model = coachModels?.[mode] ?? resolveCoachModel(mode)` and `const limit = coachDailyTurnLimits?.[mode] ?? DEFAULT_COACH_DAILY_TURN_LIMITS[mode]`, and remove the `DEFAULT_COACH_DAILY_TURN_LIMIT` import at line 12.
- [ ] In `apps/api/src/index.ts`, delete the `coachModelFromEnv` and `coachDailyTurnLimitFromEnv` imports and the `coachModel` constant (line 33), and stop passing `coachModel` (lines 46 and 57) and `coachDailyTurnLimit` to `createApp`.
- [ ] In `apps/api/src/coach/bind.ts`, delete `coachModel` from `CoachRuntimeConfig` (line 14) and the destructure (line 27), and the `model: coachModel ?? DEFAULT_COACH_MODEL` line (39). In `apps/api/src/coach/runtime.ts`, make `model` a required option or drop it and use `input.model` only. The `streamTurn` line `input.model ?? model` (near line 113) becomes `input.model`, since `coach/http.ts` always sets `model` at its call. Remove the `DEFAULT_COACH_MODEL` import at line 7 and the default at line 78.
- [ ] In `apps/api/src/coach/fake.ts` line 35, replace `DEFAULT_COACH_MODEL` with `DEFAULT_COACH_MODELS.free`. In `apps/api/src/test/harness.ts`, delete `coachModel` and `coachDailyTurnLimit` from `createTestApp` options and the `createApp` call (lines 35 and 50 and neighbors).
- [ ] Tests follow the code. In `config.test.ts` delete the `coachModelFromEnv` describe (lines 98-112) and the `coachDailyTurnLimitFromEnv` describe (lines 125-152). In `coach/domain.test.ts` delete `uses deprecated COACH_MODEL only when mode is unset` (lines 285-292), the `DEFAULT_COACH_MODEL` expectation at line 58, the `DEFAULT_COACH_DAILY_TURN_LIMIT` expectation at line 60, and the global-cap assertions near lines 316-320. Replace `DEFAULT_COACH_MODEL` in `coach/translate.test.ts`, `coach/bind.test.ts` and `coach/eval/report.test.ts` with a mode default.
- [ ] In `coach/deploy-docs.test.ts` remove `"COACH_MODEL"` (line 19) and `"COACH_DAILY_TURN_LIMIT"` (line 23) from the required list and drop the `COACH_DAILY_TURN_LIMIT=50` expectation (line 39). Keep the per-mode names and the `.env.example` check.
- [ ] In `docs/railway.md` delete the `COACH_MODEL` row (line 48) and the `COACH_DAILY_TURN_LIMIT` row (line 52). In `.env.example` delete the sentence about the deprecated fallback (lines 61-62), `# COACH_MODEL=...` (line 68) and `# COACH_DAILY_TURN_LIMIT=50` (line 73).
- [ ] Ops step in the PR body. If Railway has `COACH_MODEL` or `COACH_DAILY_TURN_LIMIT` set on staging or production, they are removed in the same step. After removal the per-mode variables decide everything.

**You see.**

- [ ] `grep -rn "coachModelFromEnv\|COACH_MODEL\b\|COACH_DAILY_TURN_LIMIT\b\|DEFAULT_COACH_MODEL\b" apps packages docs .env.example --include=*.ts --include=*.md --include=.env.example` prints no match (per-mode names like `COACH_MODEL_FREE` do not match the `\b` pattern).
- [ ] Booting with `COACH_MODEL=openai/legacy COACH_DAILY_TURN_LIMIT=1` changes nothing. A Free turn is recorded in `coach_usage` with `model` equal to `openrouter/free`, and a second turn the same day still succeeds.
- [ ] `docs/railway.md` lists `COACH_MODEL_FREE`, `COACH_MODEL_LIGHT`, `COACH_MODEL_MAX` and the three per-mode limits, and no legacy row.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/coach/domain.test.ts` gains `ignores COACH_MODEL and COACH_DAILY_TURN_LIMIT`, calling `resolveCoachModel("free", { COACH_MODEL: "x" } as never)` and `resolveCoachDailyTurnLimit("free", { COACH_DAILY_TURN_LIMIT: "1" } as never)` and expecting the mode defaults. Red first at trunk (the global cap of 1 wins in the limit case), green after. Run `pnpm --filter api test src/coach/domain.test.ts`.
- [ ] `apps/api/src/coach/deploy-docs.test.ts` still passes with the shorter name list, and gains `does not document the removed variables` expecting neither file to contain `COACH_DAILY_TURN_LIMIT=` or a `| COACH_MODEL |` row. Red first, then green. Run `pnpm --filter api test src/coach/deploy-docs.test.ts`.
- [ ] Full api and domain suites. Run `pnpm --filter api test` and `pnpm --filter @workspace/domain test`, plus `pnpm typecheck` at the repo root so the web app, which imports the domain package, still compiles.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Start the PGlite api with `COACH_RUNTIME=fake`, sign up with curl, read the Welcome thread id from `GET /api/threads`, and `curl -N -X POST /api/threads/<id>/coach` with a minimal body that satisfies `coachTurnRequestSchema` (`packages/domain/src/threads.ts:93`), at trunk and head. Save `pr7-regression.png`. Pass when the SSE event names and order are identical at trunk and head, ending with the message end event.
- [ ] Lane 2. Legacy variables are inert. Start the head api with `COACH_MODEL=openai/legacy COACH_DAILY_TURN_LIMIT=1 COACH_RUNTIME=fake`, run two Free turns by curl. Save `pr7-legacy-inert.png`. Pass when both turns complete with HTTP 200 and the second is not the `coachLimitReachedEnvelope` 429.
- [ ] Lane 3. Per-mode limit still enforced. Start the head api with `COACH_DAILY_TURN_LIMIT_FREE=1 COACH_RUNTIME=fake`, run two Free turns. Save `pr7-mode-limit.png`. Pass when the first answers 200 and the second answers 429 with the `COACH_LIMIT_REACHED` envelope.
- [ ] Lane 4. Per-mode model env. Start the head api with `COACH_MODEL_LIGHT=openai/test-light`, a stub OpenRouter endpoint, and `OPENROUTER_API_KEY=test`, then run a Light turn. Save `pr7-light-model.png`. Pass when the captured request body has `"model":"openai/test-light"` and `coach_usage` stores that model for the turn.
- [ ] Lane 5. Default model per mode. Start the head api with no model variables and the same stub, and run one Free, one Light and one Max turn. Save `pr7-default-models.png`. Pass when the stub sees `openrouter/free`, `deepseek/deepseek-chat-v3.1` and `anthropic/claude-opus-4` in that order.
- [ ] Lane 6. Web UI, send a message. Using `agent-browser` with the web per the boot recipe and the fake runtime, sign up, open the Welcome thread, send "Hello", wait for the reply. Save `pr7-ui-coach-turn.png`. Pass when a streamed Coach reply is visible and no error banner shows.
- [ ] Lane 7. Web UI, mode switch. In the same session switch the mode from Free to Light and send another message. Save `pr7-ui-mode-switch.png`. Pass when the second reply renders and the mode chip shows Light.
- [ ] Lane 8. Boot without a key. Start the head api with no `OPENROUTER_API_KEY` and no `COACH_RUNTIME`, then `curl -i /health` and a signed-in coach POST. Save `pr7-no-key.png`. Pass when health is 200 and the coach POST is 503 `COACH_UNAVAILABLE`.
- [ ] Lane 9. Docs read-back. Render `docs/railway.md` (the Coach table) and `.env.example` lines 55-75 at head with `sed -n`. Save `pr7-docs.png`. Pass when neither shows `COACH_MODEL` as a standalone name or `COACH_DAILY_TURN_LIMIT` without a `_FREE`, `_LIGHT` or `_MAX` suffix.
- [ ] Lane 10. Whole-repo gates. Run `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter web test`. Save `pr7-gates.png`. Pass when typecheck and lint exit 0 (lint keeps the 2 baseline web warnings), api shows 0 failed, and web shows 478 passed and 1 skipped.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of `pnpm --filter api typecheck` in seconds, plus the count of lines under `apps/api/src` and `packages/domain/src/coach.ts`.
- [ ] Probe. Run `/usr/bin/time -f %e pnpm --filter api typecheck` five times at trunk and five at head, interleaved, each with `tsc` incremental output removed first. Both sides produce the metric.
- [ ] Baseline. Record the trunk median first.
- [ ] Rule. Head median must not exceed trunk's by more than 3 percent, and head must have fewer lines than trunk. Fail otherwise.

**Review gate.** None. PR-7 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Split must-edit.ts and coach/http.ts along their seams (PR-8)

**Depends on.** PR-7.

**Files.**

- [ ] Edit `apps/api/src/coach/must-edit.ts`.
- [ ] Create `apps/api/src/coach/must-edit-intent.ts`.
- [ ] Create `apps/api/src/coach/focus-doc.ts`.
- [ ] Create `apps/api/src/coach/tool-dump.ts`.
- [ ] Create `apps/api/src/coach/rewrite.ts`.
- [ ] Create `apps/api/src/coach/replacement-text.ts`.
- [ ] Edit `apps/api/src/coach/http.ts`.
- [ ] Create `apps/api/src/coach/sse.ts`.
- [ ] Create `apps/api/src/coach/turn.ts`.

**Build.**

- [ ] Pure moves only. No signature, name, regex or string changes. Do the move with cut and paste, then fix imports, then run the suite. The PR body states the line ranges moved.
- [ ] Create `coach/must-edit-intent.ts` from `must-edit.ts` lines 30-160 (`isPaperEditAsk`, `latestUserText`, `mustEditTurnInstruction`, `mustEditToolChoice`, `mustEditPrepareStep`, `mustEditStillNeedsUpdate`, `toolNamesFromSteps` and the `MUST_EDIT_TOOLS` types).
- [ ] Create `coach/focus-doc.ts` from lines 167-310 (`toCoachFocusDoc`, `describeFocusDoc`, `namesExperienceOrBullet`, `namedOtherCvSection`, `describeExperienceRoles`).
- [ ] Create `coach/tool-dump.ts` from lines 307-403 (`isToolDumpText`, `stripToolDumpText`).
- [ ] Create `coach/rewrite.ts` from lines 516-610 and 771-866 (`findFocusRewriteOriginal`, `applyRewriteToFocusContent`, `localRewriteText`, `isRealRewrite`, `shouldUseFreeTextMustEdit`, and the locate and apply helpers). Move the miss-copy functions at lines 404-515 (`textNamesExperienceRole`, `isExperienceNamedMiss`, `mustEditMissCopy`, `mustEditNoRewriteCopy`) into `coach/must-edit.ts` itself, which keeps the barrel plus that cohesive remainder.
- [ ] Create `coach/replacement-text.ts` from lines 636-770 (`freeMustEditLinePrompt`, `stripMustEditThinking`, `sanitizeMustEditLine`, `extractMustEditReplacement`).
- [ ] Keep `coach/must-edit.ts` exporting every symbol it exports today through `export * from "./must-edit-intent.js"` and the same for the other new files, so no importer and no test file changes. Check for a circular import with `pnpm --filter api exec madge` or a `tsc` run, and fix by moving shared constants to the lower file.
- [ ] Create `coach/sse.ts` from `coach/http.ts` lines 664-738 (`isDisconnected`, `waitForAbort`, `takeUntilAbort`, `writeEvent`, `writeHeartbeat`), exported.
- [ ] Create `coach/turn.ts` from `coach/http.ts` lines 391-662 (`RunCoachTurnOptions`, `runCoachTurn`, `applyStreamPart`, `sseDataForPart`, `persistCoachTurn`), importing from `./sse.js`, and export `runCoachTurn`.
- [ ] Leave `coach/http.ts` as routes only, about 390 lines, importing `runCoachTurn` from `./turn.js`. Its three routes at lines 88, 252 and 320 stay in place.

**You see.**

- [ ] `wc -l apps/api/src/coach/http.ts` prints 400 or fewer, down from 738, and `wc -l apps/api/src/coach/must-edit.ts` prints 250 or fewer, down from 866, with no new file above 300 lines.
- [ ] `pnpm --filter api test src/coach` prints the same number of passing tests as trunk, including the 727-line `must-edit.test.ts` untouched, and `git diff --stat` shows `must-edit.test.ts` and `http.test.ts` with 0 changed lines.
- [ ] `git diff -M --color-moved=dimmed-zebra` shows the moved blocks as moved, with changes only in `import` and `export` lines.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add `apps/api/src/coach/must-edit-exports.test.ts` that imports `* as barrel from "./must-edit.js"` and asserts the sorted list of export names equals the list captured from trunk (the list is committed in the test file). Red is not possible for a pure move, so the proof is that it is written and passes at trunk first, then passes at head. Run `pnpm --filter api test src/coach/must-edit-exports.test.ts`.
- [ ] Existing coach suites pass unchanged at head. Run `pnpm --filter api test src/coach`.
- [ ] The existing `apps/api/src/coach/aisdk-isolation.test.ts` passes as is, which shows the new `turn.ts` does not import the AI SDK. Run `pnpm --filter api test src/coach/aisdk-isolation.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Start the PGlite api with `COACH_RUNTIME=fake`, sign up, and `curl -N -X POST /api/threads/<id>/coach` with a valid body, at trunk and head. Save `pr8-regression.png`. Pass when the SSE event names, their order and the `data:` payload shapes match, with only ids and timestamps differing.
- [ ] Lane 2. Heartbeat. Start the head api with a short heartbeat through the harness option `coachSseHeartbeatMs: 200` in a `~/tmp` driver and `curl -N` a turn that the fake runtime holds open. Save `pr8-heartbeat.png`. Pass when at least one heartbeat frame appears before the message end event.
- [ ] Lane 3. Client disconnect. `curl -N --max-time 1` a turn, then read the thread. Save `pr8-disconnect.png`. Pass when the server log shows no unhandled rejection, the process stays up, and `GET /health` is 200 afterwards.
- [ ] Lane 4. Feedback route. `POST /api/threads/<id>/messages/<messageId>/feedback` with a rating after a completed turn. Save `pr8-feedback.png`. Pass when the response is 200 `"ok":true` at trunk and head.
- [ ] Lane 5. Reverse route. `POST /api/threads/<id>/messages/<messageId>/reverse` on a message with a reversible receipt, signed in as the owner and then as another user. Save `pr8-reverse.png`. Pass when the owner gets the same status as trunk and the other user gets 404 or 403 as at trunk.
- [ ] Lane 6. Web UI, streamed reply. Using `agent-browser` with the web per the boot recipe and the fake runtime, sign up, open the Welcome thread, send "Hello". Save `pr8-ui-turn.png`. Pass when the reply streams in and finishes with no error banner.
- [ ] Lane 7. Web UI, must-edit flow. Open Paper, create or open a CV doc, ask the Coach "fix my summary" with the doc focused, using the fake runtime. Save `pr8-ui-must-edit.png`. Pass when the Coach answers in the thread without a crash and the network log shows the coach POST completing with 200.
- [ ] Lane 8. Barrel check from the built output. Run `pnpm --filter api build` then `node -e` importing `dist/coach/must-edit.js` and printing `Object.keys(...).length` at trunk and head. Save `pr8-barrel.png`. Pass when the key counts are equal.
- [ ] Lane 9. Circular import check. Run `pnpm --filter api exec tsc --noEmit` and `npx madge --circular apps/api/src/coach` from the repo root. Save `pr8-circular.png`. Pass when typecheck exits 0 and madge reports no circular dependency that trunk lacks.
- [ ] Lane 10. Line count and moved-block audit. Run `wc -l` on the nine files and `git diff -M --stat main...HEAD`. Save `pr8-moves.png`. Pass when `http.ts` is at most 400 lines, `must-edit.ts` at most 250, no new file exceeds 300, and total inserted lines minus deleted lines is under 80 (imports and headers only).

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of `pnpm --filter api typecheck` and of `pnpm --filter api test src/coach`, in seconds.
- [ ] Probe. Run `/usr/bin/time -f %e` on each command five times at trunk and five at head, interleaved, with the `tsc` build info removed before each typecheck run. Both sides produce the metric.
- [ ] Baseline. Record the trunk medians first.
- [ ] Rule. Head medians must be within 5 percent of trunk's for both commands. A head median more than 5 percent slower fails the PR.

**Review gate.** None. PR-8 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
## Lazy-load the app routes (PR-9)

**Depends on.** None.

**Files.**

- [ ] Edit `apps/web/src/router.tsx`.
- [ ] Edit `apps/web/src/features/paper/coach-float.tsx`.
- [ ] Create `apps/web/src/router-lazy.test.tsx`.
- [ ] Edit `apps/web/vite.config.ts` (only if the measurement step below says the vendor chunk still dominates).

**Build.**

- [ ] In `apps/web/src/router.tsx`, drop the eager imports at lines 14 to 21 of `PublicPitchPage`, `ApplyPage`, `PaperPage`, `PitchPage`, `SearchPage` and `SettingsPage`. Keep `HomePage`, `SignInPage` and `SignUpPage` eager.
- [ ] In `apps/web/src/router.tsx`, add `lazyRouteComponent` to the `@tanstack/react-router` import and set `component: lazyRouteComponent(() => import("@/routes/paper.tsx"), "PaperPage")` on `paperRoute`. Do the same for `applyRoute` (`ApplyPage`), `pitchRoute` (`PitchPage`), `searchRoute` (`SearchPage`) and `settingsRoute` (`SettingsPage`).
- [ ] In `apps/web/src/router.tsx`, make `publicPitchRoute` (the `/u/$slug` route) lazy by loading `PublicPitchPage` from `@/features/pitch/pitch-public-page.tsx` with `lazyRouteComponent` and rendering it with `slug` from `publicPitchRoute.useParams()`.
- [ ] In `apps/web/src/features/paper/coach-float.tsx`, replace the static import of `CoachThread` (line 22) with `React.lazy(() => import("@/features/coach/coach-thread.tsx").then((m) => ({ default: m.CoachThread })))` and wrap the use at line 577 in `Suspense` with the same empty-state skeleton the float already shows while a thread loads, so the assistant-ui runtime loads only when the float opens.
- [ ] Build with `pnpm --filter web build` and record the chunk table. If the largest chunk is still above 600 kB and it is a vendor bundle (React, TanStack, lucide), add `build.rollupOptions.output.manualChunks` in `apps/web/vite.config.ts` that splits `@assistant-ui` and `lucide-react` into their own chunks. Add nothing to `vite.config.ts` if the largest chunk is already at or below 600 kB.
- [ ] If the `/sign-in` rule in the perf section fails after the steps above, also load `AppShellLayout` with `lazyRouteComponent` in `appLayoutRoute` (the `component` at router.tsx:80), because the sign-in screen should not ship the sidebar and search modal.
- [ ] Create `apps/web/src/router-lazy.test.tsx` as described in the unit section. No other behavior changes.

**You see.**

- [ ] `pnpm --filter web build` prints several `dist/assets/*.js` lines, including separate `paper-*.js`, `apply-*.js` and `pitch-*.js` chunks, and the largest chunk is at most 900 kB (trunk is the single 1,207.38 kB `index-CiT0KIz1.js`).
- [ ] Opening `/sign-in` on the built app requests no `paper-*`, `apply-*` or `pitch-*` chunk in the network panel.
- [ ] Clicking Apply in the sidebar shows the `apply-*.js` request appear after the click, and the board renders.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/router-lazy.test.tsx` gains the case "does not load route modules until the route is visited". It mocks `@/routes/paper.tsx` and `@/routes/apply.tsx` with `vi.mock` factories that increment a `vi.hoisted` counter, imports `@/router.tsx`, asserts both counters are 0, then navigates a memory-history router to `/app/paper` and asserts the Paper counter is 1 and the Apply counter is still 0. Red first at trunk (the counters are 1 right after import), green at head. Run `pnpm --filter web exec vitest run src/router-lazy.test.tsx`.
- [ ] Full web suite stays green at 478 passed and 1 skipped plus the new case. Run `pnpm --filter web test`.
- [ ] Typecheck and lint stay clean. Run `pnpm --filter web typecheck && pnpm --filter web lint`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Build and serve the app with `pnpm --filter web build` then `pnpm --filter web exec vite preview --port <web port>` at trunk and at head, sign up a fresh account, open the deep link `/app/paper` and hard refresh it. Save `pr9-paper-deeplink-regression.png`. Pass when the Paper documents list renders after the refresh at both trunk and head with no console error, and at head the network panel lists a `paper-*.js` request that trunk does not have.
- [ ] Lane 2. Cold load of `/sign-in` signed out on the built head app, with a cleared cache. Read `performance.getEntriesByType("resource")` through `agent-browser` and gzip each requested JS file. Save `pr9-signin-resources.png`. Pass when no requested file name starts with `paper`, `apply`, `pitch`, `search` or `settings` and the summed gzip size is at most 300 kB.
- [ ] Lane 3. Sign in, land on `/app`, clear the network log, click Apply in the sidebar. Save `pr9-apply-navigation-chunk.png`. Pass when an `apply-*.js` request appears after the click, not before it, and the Apply board heading is visible within 3 seconds.
- [ ] Lane 4. Click Pitch in the sidebar, then use the browser Back and Forward buttons across Home, Pitch and Paper. Save `pr9-pitch-back-forward.png`. Pass when each route renders its own heading each time and the second visit to Pitch makes no new `pitch-*.js` request.
- [ ] Lane 5. Open `/app/settings` and `/app/search` by deep link with a hard refresh each. Save `pr9-settings-search-deeplink.png`. Pass when the Settings page and the Search page both render with no console error and no redirect to `/sign-in`.
- [ ] Lane 6. Signed out, open `/u/does-not-exist` on the built head app, hard refresh. Save `pr9-public-pitch-signed-out.png`. Pass when the public pitch page renders its not-found state (not a blank screen, not a redirect to `/sign-in`) and the network panel shows the public pitch chunk loading.
- [ ] Lane 7. With the api started with `COACH_RUNTIME=fake`, open `/app/paper`, clear the network log, open the Coach float, send "hello". Save `pr9-coach-float-thread-chunk.png`. Pass when the assistant-ui chunk request appears only after the float opens and the scripted reply "I looked at Apply." renders.
- [ ] Lane 8. Throttle the network to Slow 3G with `agent-browser`, click Paper in the sidebar from `/app`. Save `pr9-slow-route-load.png`. Pass when the app shell stays visible during the load and the Paper page replaces it once the chunk arrives, with no unhandled error overlay.
- [ ] Lane 9. Run `pnpm --filter web build 2>&1 | grep -E "kB|warn"` at trunk and head and screenshot the terminal. Save `pr9-build-table.png`. Pass when head lists at least 5 JS chunks, its largest is at most 900 kB, and any `manualChunks` entry in `vite.config.ts` is justified by a chunk above 600 kB in the trunk table.
- [ ] Lane 10. Audit lane. Read `git diff trunk...HEAD -- apps/web/src/router.tsx apps/web/src/features/paper/coach-float.tsx` and the vitest output of `router-lazy.test.tsx` red at trunk and green at head. Save `pr9-diff-and-red-green.png`. Pass when the diff changes only the listed imports, the `component` fields and the one `CoachThread` import, and the test is red at trunk and green at head.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Largest JS chunk size in `apps/web/dist/assets` after `pnpm --filter web build`, and the gzip bytes of the JS files requested on a cold load of `/sign-in`.
- [ ] Probe. At trunk and at head, interleaved, run `pnpm --filter web build`, then `ls -l apps/web/dist/assets/*.js | sort -k5 -n | tail -3`, then serve with `vite preview` and read `performance.getEntriesByType("resource")` on `/sign-in` through `agent-browser`, gzipping each JS file with `gzip -c <file> | wc -c`.
- [ ] Baseline. Record the trunk values first. The audit measured one chunk, `index-CiT0KIz1.js`, at 1,207.38 kB (367.35 kB gzip), which is also the `/sign-in` payload.
- [ ] Rule. Fail if the largest head chunk is above 900 kB, or if the head `/sign-in` JS gzip total is above 300 kB, or if the Rolldown warning about chunks larger than 500 kB prints without a recorded reason.

**Review gate.** None. PR-9 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Share one API envelope helper across features (PR-10)

**Depends on.** None.

**Files.**

- [ ] Create `apps/web/src/lib/api-envelope.ts`.
- [ ] Create `apps/web/src/lib/api-envelope.test.ts`.
- [ ] Edit `apps/web/src/features/apply/apply-api.ts`.
- [ ] Edit `apps/web/src/features/paper/paper-api.ts`.
- [ ] Edit `apps/web/src/features/home/thread-api.ts`.
- [ ] Edit `apps/web/src/features/home/profile-api.ts`.
- [ ] Edit `apps/web/src/features/pitch/pitch-api.ts`.

**Build.**

- [ ] In `apps/web/src/lib/api-envelope.ts`, export `type SuccessBody<T> = { ok: true; data: T }`, `function unwrapData<T>(body: SuccessBody<T>): T` and `async function runCommand<T>(name: string, input: unknown): Promise<T>` that posts JSON to `/api/commands/${name}` through `apiFetch` from `@/lib/api.ts` and returns `unwrapData(body)`. This is the body now repeated at `apply-api.ts:17-32`.
- [ ] In `apps/web/src/features/apply/apply-api.ts`, delete the local `SuccessBody`, `unwrapData` and `runCommand` (lines 17 to about 37), import them from `@/lib/api-envelope.ts`, and keep `scanApplyJob` (line 73) calling `unwrapData` on its `/api/apply/scan` post.
- [ ] In `apps/web/src/features/paper/paper-api.ts`, delete the local copies (lines 15 to about 32) and import from `@/lib/api-envelope.ts`.
- [ ] In `apps/web/src/features/home/thread-api.ts`, delete the local copies (lines 36 to about 50) and import from `@/lib/api-envelope.ts`. Leave the `/api/threads` reads at lines 53 to 125 on `unwrapData`.
- [ ] In `apps/web/src/features/home/profile-api.ts`, delete the local `SuccessBody` and `unwrapData` (lines 15 to 21) and import them. Both functions at lines 24 to 36 keep their request shape.
- [ ] In `apps/web/src/features/pitch/pitch-api.ts`, delete the local `SuccessBody` and `unwrapData` (lines 15 to 21) and import them. The `.then(unwrapData)` chain at line 46 keeps working.
- [ ] Keep every exported feature function name and signature unchanged so no caller or test mock changes. The diff must be net negative in lines.

**You see.**

- [ ] `grep -rn "function unwrapData" apps/web/src` prints exactly one line, in `apps/web/src/lib/api-envelope.ts` (trunk prints five).
- [ ] `git diff --shortstat trunk...HEAD` prints more deletions than insertions.
- [ ] `pnpm --filter web test` prints the same pass count as trunk plus the new envelope cases.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/lib/api-envelope.test.ts` is new. It stubs `fetch` and asserts `runCommand("paper.createDoc", {a: 1})` posts a JSON body to `/api/commands/paper.createDoc` and resolves to the `data` field, and that a non-2xx error envelope rejects with `ApiError` from `@/lib/api-error.ts`. Red first (the module does not exist), then green. Run `pnpm --filter web exec vitest run src/lib/api-envelope.test.ts`.
- [ ] Existing feature API tests stay green without edits. Run `pnpm --filter web exec vitest run src/features/apply/apply-api.test.ts src/features/paper/paper-api.test.ts src/features/pitch/pitch-api.test.ts`.
- [ ] Full suite and typecheck stay green. Run `pnpm --filter web test && pnpm --filter web typecheck`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Sign up a fresh account, create a Paper document through the UI, rename it and reload, at trunk and at head. Save `pr10-paper-create-regression.png`. Pass when the renamed document survives the reload at both and the network panel shows `POST /api/commands/...` returning `{"ok":true,"data":...}` at both.
- [ ] Lane 2. Apply command path. Add a job card, move it to another stage, star it, delete it. Save `pr10-apply-card-commands.png`. Pass when each action updates the board without an error banner and the network panel shows a 2xx for each command call.
- [ ] Lane 3. Apply scan path (the inline post at `apply-api.ts:73`). Paste job text into the scan field of a card and press Scan. Save `pr10-apply-scan.png`. Pass when the card title or company fills from the result, or the scan error text renders, and no unhandled exception shows in the console.
- [ ] Lane 4. Home thread reads and commands. Open Home with the api on `COACH_RUNTIME=fake`, send "hello", reload, open the thread list. Save `pr10-home-thread.png`. Pass when the thread reloads with the scripted reply and the thread list shows the new thread.
- [ ] Lane 5. Profile read and write. Open Settings, change the profile field the page offers, save, reload. Save `pr10-profile-roundtrip.png`. Pass when the saved value shows after reload.
- [ ] Lane 6. Pitch read and write. Open Pitch, edit one text field, wait for the save, reload. Save `pr10-pitch-roundtrip.png`. Pass when the edit persists after reload.
- [ ] Lane 7. Public pitch read (`pitch-api.ts:30`). Signed out, open `/u/<slug>` for the slug of the pitch from lane 6, or `/u/does-not-exist` if the page cannot publish. Save `pr10-public-pitch.png`. Pass when the page shows the pitch content or its not-found state, with no console error.
- [ ] Lane 8. Error envelope. Stop the api, then trigger a Paper rename. Save `pr10-api-down-error.png`. Pass when the UI shows an error state or banner and no blank screen, at both trunk and head with the same visible text.
- [ ] Lane 9. Duplicate scan. Run `grep -rn "SuccessBody<T> = {" apps/web/src | wc -l` and `grep -rn "function runCommand" apps/web/src | wc -l` at trunk and head and screenshot the terminal. Save `pr10-duplicate-counts.png`. Pass when trunk prints 5 and 3 and head prints 1 and 1.
- [ ] Lane 10. Audit lane. Read `git diff --stat trunk...HEAD` and the diff of `thread-api.ts`. Save `pr10-diff-stat.png`. Pass when only the seven listed files changed, deletions exceed insertions, and no exported function name changed.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Number of envelope helper definitions in `apps/web/src` and the total gzip JS bytes of `pnpm --filter web build`.
- [ ] Probe. At trunk and at head, interleaved, run `grep -rn "function unwrapData\|function runCommand" apps/web/src | wc -l` and `pnpm --filter web build`, then sum `gzip -c <file> | wc -c` over `apps/web/dist/assets/*.js`.
- [ ] Baseline. Record the trunk values first. The audit found 5 `unwrapData` copies and 3 `runCommand` copies, so the grep prints 8.
- [ ] Rule. Fail if the head grep prints more than 2, or if the head gzip total is larger than trunk.

**Review gate.** None. PR-10 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Replace effect workarounds with useEffectEvent and one storage helper (PR-11)

**Depends on.** PR-10.

**Files.**

- [ ] Edit `apps/web/src/features/paper/paper-editor.tsx`.
- [ ] Edit `apps/web/src/features/coach/coach-thread.tsx`.
- [ ] Edit `apps/web/src/features/paper/coach-float.tsx`.
- [ ] Edit `apps/web/src/features/home/aim-prompt.ts`.
- [ ] Edit `apps/web/src/features/home/first-cafe-checklist.ts`.
- [ ] Edit `apps/web/src/test/paper-seam.test.ts`.
- [ ] Create `apps/web/src/lib/local-storage.ts`.
- [ ] Create `apps/web/src/lib/local-storage.test.ts`.
- [ ] Create `apps/web/src/lib/use-flash.ts`.
- [ ] Create `apps/web/src/lib/use-flash.test.tsx`.

**Build.**

- [ ] In `apps/web/src/lib/local-storage.ts`, export `readStored<T>(key: string, parse: (raw: string | null) => T, fallback: T): T` and `writeStored(key: string, value: string): void`. Both wrap `window.localStorage` in `try/catch` and fall back (read) or stay session-only (write) when storage is blocked.
- [ ] In `apps/web/src/features/paper/paper-editor.tsx`, replace `readDocsPanel` and `writeDocsPanel` (lines 95 to 108) with `readStored(DOCS_PANEL_KEY, ...)` that accepts only `"expanded"` or `"collapsed"`, and `writeStored`. Keep `DOCS_PANEL_KEY` at `"openpath:paper:docs-panel"` (line 90).
- [ ] In `apps/web/src/features/paper/coach-float.tsx`, replace `readFloatState` and `writeFloatState` (lines 213 to 230) the same way, accepting `"closed"`, `"open"` and `"minimized"` with fallback `"closed"`. Keep `COACH_FLOAT_STORAGE_KEY` (line 51).
- [ ] In `apps/web/src/features/home/aim-prompt.ts`, replace the `try/catch` pair `readAimPromptState` and `writeAimPromptState` (lines 112 to 125) with `readStored(aimPromptStorageKey(userId), parseAimPromptState, { resolved: false, aimId: null })` and `writeStored(..., JSON.stringify(state))`. Keep the exported function names.
- [ ] In `apps/web/src/features/home/first-cafe-checklist.ts`, do the same for `readFirstCafeState` and `writeFirstCafeState` (lines 221 to 230) with fallback `{ ...EMPTY_FIRST_CAFE_STATE }`.
- [ ] In `apps/web/src/lib/use-flash.ts`, export `useFlash(ms: number): [boolean, () => void]` that sets a boolean true on trigger and resets it after `ms` with a cleared timer on unmount and on re-trigger.
- [ ] In `apps/web/src/features/coach/coach-thread.tsx`, replace the duplicated `undoneFlash` state plus timer effect in `ReceiptPart` (lines 204 to 210) and `CoachBoundBody` (lines 391 to 397) with `useFlash(UNDO_FLASH_MS)`. Replace `copied` in `MessageActions` (line 255) with `useFlash(2000)`. This makes the Copy button reset after 2 seconds, matching the Apply copy button; on trunk it stays pressed.
- [ ] In `apps/web/src/features/paper/paper-editor.tsx`, import `useEffectEvent` from `react` and wrap `persistOpenDoc` (line 333) so the autosave timer effect (lines 364 to 375) and the unmount flush effect (lines 377 to 382) call the event function without listing it. Keep their dependency lists as the retrigger conditions only.
- [ ] In `apps/web/src/features/paper/paper-editor.tsx`, wrap `applyServerDoc` (line 206) in `useEffectEvent` and delete the `eslint-disable-next-line react-hooks/exhaustive-deps` comment at line 263. Keep `[doc.id, doc.updatedAt, isCv, isProof, revertKey]` as the deps.
- [ ] In `apps/web/src/test/paper-seam.test.ts`, replace the case at lines 35 to 42 ("persists the documents panel inline without a storage helper"), which forbids a storage helper by regex, with a rendered case that collapses the documents panel in `renderApp("/app/paper")`, reads `localStorage.getItem("openpath:paper:docs-panel")`, remounts, and asserts the panel stays collapsed. Model it on `apps/web/src/routes/paper.test.tsx` lines 2493 to 2505.

**You see.**

- [ ] `pnpm --filter web lint` prints no warnings and no errors (trunk prints 2 warnings, `react-hooks/exhaustive-deps` at paper-editor.tsx:375 and :382).
- [ ] `grep -rn "eslint-disable" apps/web/src | wc -l` prints 0.
- [ ] `grep -rn "localStorage" apps/web/src --include=*.ts --include=*.tsx -l | grep -v test` lists `apps/web/src/lib/local-storage.ts` and no feature file.
- [ ] Clicking Copy on a Coach reply shows the pressed state for about 2 seconds, then it clears.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/lib/local-storage.test.ts` is new. The cases are a valid stored value is returned, an invalid value returns the fallback, `getItem` throwing returns the fallback, `setItem` throwing does not throw. Red first (module missing), then green. Run `pnpm --filter web exec vitest run src/lib/local-storage.test.ts`.
- [ ] `apps/web/src/lib/use-flash.test.tsx` is new, using fake timers. The cases are that the flag is true right after trigger, false after `ms`, a second trigger restarts the timer, unmount clears it without a state-update warning. Run `pnpm --filter web exec vitest run src/lib/use-flash.test.tsx`.
- [ ] `apps/web/src/test/paper-seam.test.ts` carries the rewritten behavior case and passes. Run `pnpm --filter web exec vitest run src/test/paper-seam.test.ts`.
- [ ] Existing storage and autosave tests stay green in `apps/web/src/routes/paper.test.tsx`, `apps/web/src/routes/home-chat.test.tsx`, `apps/web/src/routes/home.test.tsx`. Run `pnpm --filter web test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Sign up a fresh account, create a letter document in Paper, type "abc", wait 1.2 seconds, type "def", wait 1.2 seconds, reload, at trunk and at head. Save `pr11-letter-autosave-regression.png`. Pass when the reloaded document reads "abcdef" at both and the caret did not reset between the two typing bursts.
- [ ] Lane 2. Unmount flush. Type "flush me" in a letter document and within 300 ms (before the 700 ms autosave timer) click Home in the sidebar, then return to the document. Save `pr11-unmount-flush.png`. Pass when "flush me" is present.
- [ ] Lane 3. CV autosave. Open the starter CV, edit the summary field, wait 1.2 seconds, reload. Save `pr11-cv-autosave.png`. Pass when the edited summary survives the reload.
- [ ] Lane 4. Documents panel storage. Collapse the documents panel, reload, then set `localStorage["openpath:paper:docs-panel"]` to `junk` with `agent-browser` and reload. Save `pr11-docs-panel-storage.png`. Pass when the panel is collapsed after the first reload and expanded after the corrupt value, and the key still reads `collapsed` after the first step.
- [ ] Lane 5. Coach float storage. Open the Coach float in Paper, reload, then set `localStorage["openpath:paper:coach-float"]` to `junk` and reload. Save `pr11-coach-float-storage.png`. Pass when the float is open after the first reload and closed after the corrupt value.
- [ ] Lane 6. Home aim prompt and first cafe checklist. Resolve the aim prompt and tick one checklist item, reload. Save `pr11-home-storage.png`. Pass when the aim prompt stays resolved, the tick stays, and `localStorage` keys starting `openpath:home:aim-prompt` and `openpath:home:first-cafe-checklist` exist.
- [ ] Lane 7. Blocked storage. In a private-mode style session where `localStorage.setItem` throws (override it with `agent-browser` eval before load), open Paper and collapse the panel. Save `pr11-blocked-storage.png`. Pass when the panel collapses for the session and no error overlay or console exception appears.
- [ ] Lane 8. Copy flash. With the api on `COACH_RUNTIME=fake`, send "hello" in the Coach float, click Copy on the reply, snapshot immediately and again after 2.5 seconds. Save `pr11-copy-flash.png`. Pass when `aria-pressed="true"` shows in the first snapshot and is absent in the second; record that trunk stays pressed.
- [ ] Lane 9. Audit lane for the undo flash. The fake script has no reversible receipt, so run `pnpm --filter web exec vitest run src/routes/home-chat.test.tsx` and read the undo case. Save `pr11-undo-flash-test.png`. Pass when the undo and receipt cases are green and the source shows one `useFlash` call per former `undoneFlash`.
- [ ] Lane 10. Lint and disable audit. Run `pnpm --filter web lint` and `grep -rn "eslint-disable" apps/web/src` at trunk and head and screenshot the terminal. Save `pr11-lint-zero.png`. Pass when trunk prints 2 warnings and 1 disable line and head prints no warnings and no disable line.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. ESLint warning count from `pnpm --filter web lint` and total gzip JS bytes from `pnpm --filter web build`.
- [ ] Probe. At trunk and at head, interleaved, run `pnpm --filter web lint 2>&1 | grep -c warning` and `pnpm --filter web build`, then sum `gzip -c <file> | wc -c` over `apps/web/dist/assets/*.js`.
- [ ] Baseline. Record the trunk values first. The audit measured 2 warnings and a 367.35 kB gzip single chunk.
- [ ] Rule. Fail if head prints any warning, or if head gzip JS is more than 0.5 percent above trunk.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 8 screenshots into `/home/quan/tmp/opencv-review/PR-11-review-copy-flash.png`.
- [ ] Record a 30 to 60 second video of the change on a lane worktree. Save it as `/home/quan/tmp/opencv-review/PR-11-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Split the oversize Paper, Pitch and Apply files (PR-12)

**Depends on.** PR-11.

**Files.**

- [ ] Edit `apps/web/src/features/paper/paper-cv-document.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/cv-parts.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/internship.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/photo.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/product.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/service.tsx`.
- [ ] Create `apps/web/src/features/paper/cv-templates/academic.tsx`.
- [ ] Edit `apps/web/src/features/pitch/pitch-stories.tsx`.
- [ ] Create `apps/web/src/features/pitch/pitch-moments.tsx`.
- [ ] Edit `apps/web/src/features/pitch/pitch-sections.tsx`.
- [ ] Edit `apps/web/src/features/apply/apply-job-detail.tsx`.
- [ ] Create `apps/web/src/features/apply/use-job-posting.ts`.
- [ ] Edit `apps/web/src/test/design-vocabulary.test.ts`.

**Build.**

- [ ] Create `apps/web/src/features/paper/cv-templates/cv-parts.tsx` holding the shared primitives moved verbatim from `paper-cv-document.tsx`, namely `EditableField` (line 77), `ExperienceBlock` (363), `EducationBlock` (510), `SkillChips` (623), `SectionTitle` (766) and `CvPhoto` (789), with the imports they need. Export each.
- [ ] Create one file per template under `apps/web/src/features/paper/cv-templates/`, moving verbatim `InternshipCv` (line 835) to `internship.tsx`, `PhotoCv` (909) to `photo.tsx`, `ProductCv` (989) to `product.tsx`, `ServiceCv` (1176) to `service.tsx` and `AcademicCv` (1292) to `academic.tsx`. Each imports its primitives from `./cv-parts.tsx`.
- [ ] In `apps/web/src/features/paper/paper-cv-document.tsx`, keep `CvDocument` (line 134) as the template switch and keep `PAPER_CANVAS_FIELD_CLASS` (line 58) and `EditableField` exported from this path (re-export from `cv-parts.tsx`) so `paper-editor.tsx:29`, `paper-cv-document.test.tsx:14` and `routes/paper.test.tsx:26` need no edit. Target length is under 400 lines.
- [ ] In `apps/web/src/test/design-vocabulary.test.ts`, update `VOCABULARY_ALLOWLIST` (line 59 to 61) to name `features/paper/cv-templates/product.tsx` (the `bg-[#1e293b]` sidebar at the old line 1000), and add `features/paper/cv-templates/cv-parts.tsx` to `RAW_INTERACTIVE_ALLOWLIST` (the hidden file input at the old line 801), each with its reason comment on the previous line, and drop the `paper-cv-document.tsx` entries if no raw element remains there.
- [ ] Create `apps/web/src/features/pitch/pitch-moments.tsx` and move `MomentsBentoSection` (pitch-stories.tsx:445) and `BentoCard` (line 510) into it verbatim. In `apps/web/src/features/pitch/pitch-sections.tsx` change the import at line 12 to `@/features/pitch/pitch-moments.tsx`. `pitch-stories.tsx` keeps `StoryHighlightsRow`, `PitchStoryViewer`, `StoryFrame` and `StoryFramePreview` and drops under 450 lines.
- [ ] Create `apps/web/src/features/apply/use-job-posting.ts` exporting `useJobPosting({ card, jobUrl, onPatch, onScanned })` that owns `scanning`, `scanError`, `scanJdText`, `copied` (via `useFlash(2000)` from PR-11), `copyError`, `scanPosting` and `copyPosting`, moved from `JobDetailFields` (apply-job-detail.tsx lines 232 to 236 and 273 to 320). `onScanned({ title, company })` lets the component keep its own `title` and `company` state.
- [ ] In `apps/web/src/features/apply/apply-job-detail.tsx`, call `useJobPosting` from `JobDetailFields` (line 221) and delete the moved state and the inline `window.setTimeout(() => setCopied(false), 2000)` at line 287. Do not change any rendered markup.
- [ ] These are pure moves except the one hook. No logic, class or copy changes.

**You see.**

- [ ] `wc -l apps/web/src/features/paper/paper-cv-document.tsx apps/web/src/features/pitch/pitch-stories.tsx apps/web/src/features/apply/apply-job-detail.tsx` prints each under 400, 450 and 600 lines (trunk prints 1448, 600 and 723).
- [ ] `ls apps/web/src/features/paper/cv-templates` lists `academic.tsx cv-parts.tsx internship.tsx photo.tsx product.tsx service.tsx`.
- [ ] Each of the five CV templates renders in the browser identically to trunk.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/features/paper/paper-cv-document.test.tsx` gains one case that renders `CvDocument` once per template id (internship, photo, product, service, academic) and asserts each shows the candidate name and the "Experience" heading. Red first at trunk is not possible for a pure move, so record it green at trunk and green at head. Run `pnpm --filter web exec vitest run src/features/paper/paper-cv-document.test.tsx`.
- [ ] `apps/web/src/routes/apply.test.tsx` gains a case that clicks Copy on the posting link and asserts the "Copied" label appears then clears after 2 seconds with fake timers. Run `pnpm --filter web exec vitest run src/routes/apply.test.tsx`.
- [ ] Design vocabulary test stays green with the updated allowlists. Run `pnpm --filter web exec vitest run src/test/design-vocabulary.test.ts`.
- [ ] Full suite, lint and typecheck stay green. Run `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web typecheck`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Sign up a fresh account, open the starter CV in Paper, pick the Internship template, and screenshot the canvas at 1280 by 900 at trunk and at head. Save `pr12-internship-trunk-vs-head.png`. Pass when the two canvases are pixel-identical or differ by under 0.1 percent of pixels in an image diff.
- [ ] Lane 2. Same comparison for the Photo template. Save `pr12-photo-trunk-vs-head.png`. Pass when the canvases match within 0.1 percent of pixels, including the photo placeholder.
- [ ] Lane 3. Same comparison for the Product template. Save `pr12-product-trunk-vs-head.png`. Pass when the canvases match within 0.1 percent of pixels, including the dark sidebar colour.
- [ ] Lane 4. Same comparison for the Service template. Save `pr12-service-trunk-vs-head.png`. Pass when the canvases match within 0.1 percent of pixels.
- [ ] Lane 5. Same comparison for the Academic template. Save `pr12-academic-trunk-vs-head.png`. Pass when the canvases match within 0.1 percent of pixels.
- [ ] Lane 6. CV editing parity. In the Product template edit the summary, add an experience bullet, upload a photo through the hidden file input, wait for autosave, reload. Save `pr12-cv-edit-roundtrip.png`. Pass when all three edits persist and no console error appears.
- [ ] Lane 7. Pitch page visual comparison. Open `/app/pitch` at trunk and at head with the same seeded data, screenshot the story highlights row and the moments section. Save `pr12-pitch-trunk-vs-head.png`. Pass when both screenshots match within 0.1 percent of pixels.
- [ ] Lane 8. Pitch interactions. Open a story from the highlights row, let the timer advance, press the pause control, close the viewer, then add a moment card in edit mode. Save `pr12-pitch-stories-moments.png`. Pass when the viewer advances, pauses, closes and the new moment card shows.
- [ ] Lane 9. Apply job detail. Open a card's detail, paste job text and press Scan, then click Copy on the posting link. Save `pr12-apply-detail-scan-copy.png`. Pass when the scan result or the scan error renders, the "Copied" label shows and clears after about 2 seconds, and the layout matches trunk.
- [ ] Lane 10. Audit lane. Run `git diff -M --stat trunk...HEAD` and `wc -l` on the moved files. Save `pr12-move-audit.png`. Pass when git reports the template and moments files as renames or copies of trunk code, the only new logic is `use-job-posting.ts`, and no file in `cv-templates/` exceeds 560 lines.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Line count of the three oversize files and total gzip JS bytes from `pnpm --filter web build`.
- [ ] Probe. At trunk and at head, interleaved, run `wc -l` on the three files, then `pnpm --filter web build` and sum `gzip -c <file> | wc -c` over `apps/web/dist/assets/*.js`.
- [ ] Baseline. Record the trunk values first. The audit measured 1448, 600 and 723 lines.
- [ ] Rule. Fail if `paper-cv-document.tsx` is above 400 lines, `pitch-stories.tsx` above 450, `apply-job-detail.tsx` above 600, or head gzip JS is more than 0.5 percent above trunk.

**Review gate.** None. PR-12 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Reduce the coach turn hook to one reducer (PR-13)

**Depends on.** PR-12.

**Files.**

- [ ] Edit `apps/web/src/features/coach/use-coach-turn.ts`.
- [ ] Create `apps/web/src/features/coach/turn-state.ts`.
- [ ] Create `apps/web/src/features/coach/turn-state.test.ts`.
- [ ] Edit `apps/web/src/features/coach/use-coach-turn.test.ts`.

**Build.**

- [ ] Name the state type first. In `apps/web/src/features/coach/turn-state.ts` export `type TurnState` as a union with four members keyed by `status`. `idle` carries `messages: HomeMessage[] | null` (the optimistic list, replacing `optimisticMessages` at use-coach-turn.ts:67). `streaming` carries `kind: "send" | "regenerate"`, `messages: HomeMessage[]` and `waiting: boolean` (true until the first delta, replacing the `TurnPhase` value `waiting`). `error` carries `kind`, `messages` and `error: SendError` (the type at line 38, which absorbs `regenerateError`). `aborted` carries `messages`. Export `type TurnAction` with `start`, `delta`, `finish`, `fail`, `abort` and `reset`, and `turnReducer(state, action)`.
- [ ] In `turn-state.ts` export `turnPhase(state): TurnPhase` that maps the reducer state onto the existing `"idle" | "waiting" | "streaming"` union from `@/features/home/thread-store-context.ts` (line 36) so the thread store and `coach-dock.tsx` stay unchanged.
- [ ] In `apps/web/src/features/coach/use-coach-turn.ts`, replace the four `useState` calls at lines 67 to 72 (`optimisticMessages`, `phase`, `sendError`, `regenerateError`) with one `useReducer(turnReducer, { status: "idle", messages: null })`. Keep `sendGeneration` and `abortRef` refs.
- [ ] In `use-coach-turn.ts`, extract one `runCoachStream` function used by `send` (starts at line 269) and `regenerate` (line 486). It takes the kind, the baseline message list (filtering `STREAMING_COACH_ID` and falling back to `toHomeMessages(detailQuery.data...)`, now written once instead of at lines 281 to 283 and 494 to 496), and the `AbortController`, and dispatches `delta`, `finish`, `fail` or `abort`. `hydrateThread` and `keepStreamedCoach` are called from this one loop.
- [ ] Reduce `send` and `regenerate` to building their own request and calling `runCoachStream`. `stop` (line 265) dispatches `abort`; `retry` (line 652) dispatches `reset` and re-runs. `rate` (line 662) and `undo` (line 694) stay as they are.
- [ ] Leave `writeDetail` (lines 98 to 115) and `rememberListItem` alone. The target is `use-coach-turn.ts` under 450 lines (trunk 720).
- [ ] Keep every value returned from `useCoachTurn` and every text from `coachSendErrorMessage` (`apps/web/src/features/home/coach-error.ts`) unchanged.

**You see.**

- [ ] `wc -l apps/web/src/features/coach/use-coach-turn.ts` prints under 450 (trunk 720), and `grep -c "useState" apps/web/src/features/coach/use-coach-turn.ts` prints 0.
- [ ] `pnpm --filter web exec vitest run src/routes/home-chat.test.tsx src/features/coach` prints all cases passing.
- [ ] A real streamed turn against the api shows the scripted reply "I looked at Apply. Prep the starred one next." in the thread.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/features/coach/turn-state.test.ts` is new. The cases are `idle` to `streaming` on `start`, `delta` clears `waiting`, `finish` returns to `idle` with the final messages, `fail` yields `error` with the mapped message, `abort` yields `aborted`, `reset` returns to `idle`, and a `delta` after `abort` is ignored. Red first (module missing), then green. Run `pnpm --filter web exec vitest run src/features/coach/turn-state.test.ts`.
- [ ] `apps/web/src/features/coach/use-coach-turn.test.ts` gains a case that regenerate after an aborted send leaves one assistant message, not two. Run `pnpm --filter web exec vitest run src/features/coach/use-coach-turn.test.ts`.
- [ ] Existing `apps/web/src/routes/home-chat.test.tsx` and the `apps/web/src/test/threads-api-mock.ts` scripts stay green without edits to either. Run `pnpm --filter web exec vitest run src/routes/home-chat.test.tsx` then `pnpm --filter web test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. With the api on `COACH_RUNTIME=fake`, sign up a fresh account, send "hello" from Home at trunk and at head. Save `pr13-streamed-turn-regression.png`. Pass when the reply "I looked at Apply. Prep the starred one next." renders at both, the Stop button is gone at the end, and the thread appears in the thread list.
- [ ] Lane 2. Abort mid-stream. Start a local delaying proxy under `~/tmp` that forwards to the api and pauses 500 ms between SSE chunks of `/api/threads/:id/coach`, point `VITE_API_URL` at it, send "hello", click the `Stop` button (aria-label "Stop") after the first text appears. Save `pr13-abort-midstream.png`. Pass when the stream stops, only the partial text remains, the composer is enabled again, and no error banner shows.
- [ ] Lane 3. Send after abort. Directly after lane 2, send "again". Save `pr13-send-after-abort.png`. Pass when a fresh full reply streams and the partial message from lane 2 is not duplicated.
- [ ] Lane 4. Regenerate. After a completed reply click `Regenerate` (aria-label "Regenerate"). Save `pr13-regenerate.png`. Pass when the last assistant message is replaced by a new reply and the thread still has exactly one assistant message for that turn.
- [ ] Lane 5. Abort during regenerate. With the delaying proxy, click Regenerate and then Stop mid-stream. Save `pr13-regenerate-abort.png`. Pass when the composer re-enables with no error banner and no duplicated assistant message.
- [ ] Lane 6. Daily cap error. Start the api with `COACH_DAILY_TURN_LIMIT=1` (and the per-mode caps from `.env.example` lines 73 to 75 set to 1), send two messages. Save `pr13-daily-cap.png`. Pass when the second send shows "You've reached today's limit for this Coach mode. Try another mode, or come back tomorrow." and the first reply is still on screen.
- [ ] Lane 7. Retry after error. Stop the api during a send so it fails with the network message, restart it, press Retry. Save `pr13-retry-after-error.png`. Pass when "Couldn't reach the Coach. Check your connection and try again." shows first and the retry produces the scripted reply.
- [ ] Lane 8. Reload mid-thread. After two turns reload the page and reopen the thread. Save `pr13-reload-hydration.png`. Pass when both turns hydrate from the api in order with no duplicated or missing message.
- [ ] Lane 9. Coach float in Paper. Open the Coach float, send "hello", abort, regenerate. Save `pr13-coach-float-turn.png`. Pass when the float thread behaves like Home with no console error.
- [ ] Lane 10. Audit lane. Run `grep -c "setPhase\|setSendError\|setRegenerateError\|setOptimisticMessages" apps/web/src/features/coach/use-coach-turn.ts` at trunk and head and the `turn-state.test.ts` run. Save `pr13-state-audit.png`. Pass when trunk prints 55 or more setter calls in total, head prints 0, and the reducer tests are green.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Line count of `use-coach-turn.ts`, and time from clicking send to the full scripted reply on screen with the fake runtime.
- [ ] Probe. At trunk and at head, interleaved, run `wc -l apps/web/src/features/coach/use-coach-turn.ts`, then send "hello" five times through `agent-browser` and record the time from click to the text "Prep the starred one next." visible, taking the median.
- [ ] Baseline. Record the trunk values first. The audit measured 720 lines.
- [ ] Rule. Fail if head is above 450 lines, or if the head median reply time is more than 100 ms slower than trunk.

**Review gate.** None. PR-13 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Make the web tests assert behavior (PR-14)

**Depends on.** PR-13.

**Files.**

- [ ] Delete `apps/web/src/test/paper-seam.test.ts`.
- [ ] Delete `apps/web/src/test/apply-seam.test.ts`.
- [ ] Delete `apps/web/src/test/pitch-seam.test.ts`.
- [ ] Delete `apps/web/src/test/starter-seam.test.ts`.
- [ ] Delete `apps/web/src/test/auth-seam.test.ts`.
- [ ] Create `apps/web/src/test/surface-behavior.test.tsx`.
- [ ] Edit `apps/web/eslint.config.js`.
- [ ] Edit `apps/web/src/routes/paper.test.tsx`.
- [ ] Create `apps/web/src/test/mock-http.ts`.
- [ ] Edit `apps/web/src/test/threads-api-mock.ts`.
- [ ] Edit `apps/web/src/test/paper-api-mock.ts`.
- [ ] Edit `apps/web/src/test/apply-api-mock.ts`.
- [ ] Edit `apps/web/src/test/profile-api-mock.ts`.
- [ ] Edit `apps/web/src/test/pitch-api-mock.ts`.

**Build.**

- [ ] Delete the shell-import and Outlet cases that only mirror source text, namely the "mounts ... from the feature module", "keeps the ... workspace free of shell chrome imports" and "lets the shell swap ... only through the layout Outlet" cases in `paper-seam.test.ts` (lines 14, 24, 44), `apply-seam.test.ts` (14, 24, 34) and `pitch-seam.test.ts` (25, 35, 45). Replace the import boundary with a `no-restricted-imports` override in `apps/web/eslint.config.js` for `src/features/paper/**`, `src/features/apply/**` and `src/features/pitch/**` that forbids `@/router`, `@/features/app-shell/*` and `@/components/search-modal*`.
- [ ] Delete `auth-seam.test.ts` (it checks that a deleted placeholder module stays deleted) and the file-existence checks in `starter-seam.test.ts`.
- [ ] In `apps/web/src/test/surface-behavior.test.tsx`, keep the product claims the old files protected as rendered tests using the existing api mocks. Case 1 renders Paper, Apply, Pitch and Home with empty api data and asserts the empty states show and no sample card or document text appears (replaces `starter-seam.test.ts:17,35` and `apply-seam.test.ts:61`). Case 2 renders the Pitch workspace with a `fetch` spy and asserts every request URL targets the api origin, never GitHub or a third-party host (replaces `pitch-seam.test.ts:56,67`). Case 3 asserts the Pitch workspace shows no seeded persona name (replaces `pitch-seam.test.ts:86`). Case 4 asserts no Apply surface renders a "Fit" label (replaces `apply-seam.test.ts:45`).
- [ ] In `apps/web/src/routes/paper.test.tsx`, replace the style assertions with role and text queries. Remove the `className` and `toHaveClass` assertions at lines 652 to 656, 686 to 688 and 697 to 702 (the `bg-muted/80`, `border-input` and `rounded-full` checks) and the other class-string checks, and replace `querySelector` lookups (37 today) with `getByRole`, `getByLabelText` or `getByText` where a role exists. Keep the `data-paper-canvas-field` attribute assertions because that attribute is a contract. The `design-vocabulary.test.ts` file keeps guarding classes.
- [ ] Create `apps/web/src/test/mock-http.ts` exporting `isoNow`, `urlOf`, `pathOf`, `jsonOk` and `jsonError`, taken from the identical copies in `threads-api-mock.ts` (lines 108 to 130), `paper-api-mock.ts` (30 to 44), `apply-api-mock.ts` (40 to 58), `profile-api-mock.ts` (34 to 44) and `pitch-api-mock.ts` (48 to 79). Delete the local copies and import from `./mock-http.ts`. Do not change what any mock returns. `threads-api-mock.ts` (652 lines) must end under 600.

**You see.**

- [ ] `ls apps/web/src/test/*-seam.test.ts` prints no such file.
- [ ] `grep -c "querySelector" apps/web/src/routes/paper.test.tsx` prints at most 10 (trunk 37) and `grep -c "toHaveClass\|className" apps/web/src/routes/paper.test.tsx` prints at most 5 (trunk 28).
- [ ] `grep -rn "function jsonOk" apps/web/src/test | wc -l` prints 1 (trunk prints at least 2).
- [ ] `pnpm --filter web lint` prints no errors, and a throwaway import of `@/router` inside `features/paper/` makes it print a `no-restricted-imports` error.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/test/surface-behavior.test.tsx` is new. Prove each case catches its regression by temporarily make the Pitch workspace call `fetch("https://api.github.com/users/x")` and confirm case 2 is red, then revert and confirm green. Run `pnpm --filter web exec vitest run src/test/surface-behavior.test.tsx`.
- [ ] The lint rule is proven red then green. Add `import "@/router.tsx"` to `apps/web/src/features/paper/paper-workspace.tsx`, run `pnpm --filter web lint` and see the error, then remove it. Run `pnpm --filter web lint`.
- [ ] `apps/web/src/routes/paper.test.tsx` stays green after the rewrite. Run `pnpm --filter web exec vitest run src/routes/paper.test.tsx`.
- [ ] All five mocks work through `mock-http.ts`. Run `pnpm --filter web test` and expect no failures and no skipped additions beyond the one skip on trunk.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm --filter web test` at trunk and at head and screenshot the summary lines. Save `pr14-suite-trunk-vs-head.png`. Pass when both end with zero failed and head has fewer test files than trunk's 63 by the number of deleted seam files, plus one new file.
- [ ] Lane 2. Empty-state product claim in the browser. Sign up a fresh account on the PGlite api and open Paper, Apply, Pitch and Home. Save `pr14-empty-states.png`. Pass when each surface shows its empty state and no sample document, card or persona name.
- [ ] Lane 3. Pitch makes no third-party calls. Open Pitch with the network panel recording and load the GitHub section. Save `pr14-pitch-network.png`. Pass when every request goes to the api origin or the web origin and none goes to `github.com` or another host.
- [ ] Lane 4. Apply has no Fit label. Add a card and open its detail. Save `pr14-apply-no-fit.png`. Pass when the board, the card and the drawer show no "Fit" label.
- [ ] Lane 5. Paper canvas behavior that the rewritten tests cover. Open a CV, click a canvas field, type, and press Enter in a bullet. Save `pr14-paper-canvas-behavior.png`. Pass when the field is editable via its role and label and `data-paper-canvas-field` is present.
- [ ] Lane 6. Lint boundary. In a lane worktree add `import "@/router.tsx"` to `features/apply/apply-workspace.tsx` and run `pnpm --filter web lint`. Save `pr14-lint-boundary-red.png`. Pass when lint prints a `no-restricted-imports` error naming that line, and prints none after the line is removed.
- [ ] Lane 7. Mock helper dedup. Run `grep -rn "function pathOf\|function jsonOk\|function isoNow\|function jsonError" apps/web/src/test` at trunk and head. Save `pr14-mock-helper-grep.png`. Pass when head lists each function once, in `mock-http.ts`, and trunk lists at least 12 definitions.
- [ ] Lane 8. Style-coupling removed. Run `grep -n "toHaveClass\|className" apps/web/src/routes/paper.test.tsx` at head. Save `pr14-paper-test-style-grep.png`. Pass when at most 5 lines print and none matches `bg-`, `border-` or `rounded-`.
- [ ] Lane 9. Rename survives. In a lane worktree make a harmless refactor such as renaming a local variable inside `PaperWorkspace` and add a blank line to `apps/web/src/features/apply/apply-workspace.tsx`, then run `pnpm --filter web test`. Save `pr14-harmless-rename.png`. Pass when the suite stays green (trunk's seam tests would fail on a rename of an exported symbol they regex).
- [ ] Lane 10. Audit lane. Read `git diff --stat trunk...HEAD` and the coverage map in the PR body that pairs each deleted seam case with its replacement. Save `pr14-coverage-map.png`. Pass when every deleted case is either replaced by a named test, replaced by the lint rule, or listed as source-mirror-only with the reason.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of `pnpm --filter web test` and the count of source-text assertions (`readFileSync` in `apps/web/src/test`).
- [ ] Probe. At trunk and at head, interleaved, run `/usr/bin/time -f %e pnpm --filter web test` three times each and take the median, then `grep -rln "readFileSync" apps/web/src/test | wc -l`.
- [ ] Baseline. Record the trunk values first. The audit measured 112.6 s for 63 files and five seam files that read source text.
- [ ] Rule. Fail if the head median wall time is more than 3 percent above trunk, or if any seam test file that reads source text remains.

**Review gate.** None. PR-14 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
## Add the verify-opencv skill (PR-15)

**Depends on.** None.

**Files.**

- [ ] Edit `apps/api/src/index.ts` (the db block at lines 27-31 and the `createApp` call at line 51).
- [ ] Edit `apps/api/src/config.ts` (new `dbDriverFromEnv` and `pgliteDataDirFromEnv` beside `databaseUrlFromEnv` at line 30).
- [ ] Edit `apps/api/src/config.test.ts` (new `describe` blocks next to the one at line 42).
- [ ] Edit `.gitignore` (add `apps/api/.data/`).
- [ ] Create `.claude/skills/verify-opencv/SKILL.md`.
- [ ] Create `.claude/skills/verify-opencv/features/README.md`.
- [ ] Create `.claude/skills/verify-opencv/features/home-coach-turn.md`.
- [ ] Create `.claude/skills/verify-opencv/features/paper-edit-save.md`.
- [ ] Create `.claude/skills/verify-opencv/features/apply-board-and-scan.md`.
- [ ] Create `.claude/skills/verify-opencv/features/pitch-publish.md`.
- [ ] Create `.claude/skills/verify-opencv/features/auth.md`.
- [ ] Create `.claude/skills/verify-opencv/scripts/launch.sh`, `.claude/skills/verify-opencv/scripts/doctor.sh` and `.claude/skills/verify-opencv/scripts/cleanup.sh`, all mode 755.

**Build.**

- [ ] Add `dbDriverFromEnv(env)` to `apps/api/src/config.ts`. It returns `"pglite"` when `env.DB_DRIVER?.trim()` equals `pglite` and `undefined` otherwise, the same shape as `coachRuntimeModeFromEnv` at line 116. Add `pgliteDataDirFromEnv(env)` returning `env.PGLITE_DATA_DIR?.trim()` or `apps/api/.data/default`.
- [ ] In `apps/api/src/index.ts`, when `dbDriverFromEnv` is `pglite`, build the db with a dynamic `import("@electric-sql/pglite")` and `import("drizzle-orm/pglite")`. Open `new PGlite(dataDir)`, wrap it with `drizzle({ client, schema })`, and run `migrate(db, { migrationsFolder })` with `migrationsFolder` from `./db/paths.js`. This is the same three lines as `createMigratedTestDb` at `apps/api/src/test/harness.ts` lines 24-29, with a data dir argument added. Dynamic imports keep production from loading PGlite, which stays a dev dependency (`apps/api/package.json` line 33).
- [ ] Refuse `DB_DRIVER=pglite` when `NODE_ENV` is `production` (print one line and `process.exit(1)`), so the option cannot reach Railway by accident.
- [ ] `COACH_RUNTIME=fake` already works through `coachRuntimeModeFromEnv` (`config.ts` line 116) and `coachRuntimeFromConfig` (`apps/api/src/coach/bind.ts` line 31), so add no new flag. In `index.ts`, when the mode is `fake`, wrap the runtime with `withScanJobPosting` from `apps/api/src/coach/fake.ts` line 89 and pass a `fetchJobPosting` stub to `createApp` (option at `apps/api/src/app.ts` line 52). Both return a fixed job posting, because the demo runtime has no `scanJobPosting` and the real fetch blocks loopback hosts. The Apply scan drive then runs with no network and no tokens.
- [ ] Write `scripts/launch.sh`. It takes a run id, picks two free ports, creates `apps/api/.data/verify-<run>/`, starts the api with `DB_DRIVER=pglite COACH_RUNTIME=fake SESSION_SECRET=<32+ chars> AUTH_URL=http://localhost:<api port> WEB_ORIGINS=http://localhost:<web port> PORT=<api port> pnpm --filter api dev` and the web with `VITE_API_URL=http://localhost:<api port> pnpm --filter web dev --port <web port>`. It records both PIDs and ports in `/home/quan/tmp/opencv-verify/<run>/run.env`, logs to `api.log` and `web.log` in that dir, and prints `READY api=<port> web=<port> run=<run>` only after `GET /health` returns `{"ok":true}`, a sign-up on `POST /api/auth/sign-up/email` succeeds, and the web root answers 200.
- [ ] Write `scripts/doctor.sh`. It is read-only. It reads `run.env`, checks that each recorded PID is alive and owns its recorded port (`ss -ltnp`), that `/health` answers, that `/api/session` answers 401 or 200 and not 503, that the web answers 200, and that the working tree HEAD equals the SHA recorded at launch. It prints one `PASS` or `FAIL <check>` line per check and exits non-zero on any failure.
- [ ] Write `scripts/cleanup.sh`. It reads `run.env`, kills only the PIDs it recorded (never by process name), removes `apps/api/.data/verify-<run>/`, and leaves `/home/quan/tmp/opencv-verify/<run>/` untouched. With `KEEP_DATA=1` it keeps the data dir for a restart check. It exits 0 when run twice.
- [ ] Write `SKILL.md` with frontmatter `name: verify-opencv` and a `description` naming OpenCV, the web SPA plus Hono api surface, and when to use it. Sections are Launch, Doctor, Drive, Evidence, Cleanup and Helpers. Drive goes through the `agent-browser` skill using real routes (`/sign-up`, `/sign-in`, `/app`, `/paper`, `/apply`, `/pitch`, `/u/<slug>`) and ARIA names. Evidence states the proof standards from the create-verification-skill skill and the path `/home/quan/tmp/opencv-verify/<run>/`. It also states that two runs can coexist (own ports and own data dir) and that a run never touches Railway.
- [ ] Write the five feature files, each with the four H2s `Sub-features`, `How to get to it (user POV)`, `Driving it with agent-browser` and `Gotchas`, plus the `features/README.md` index. Home covers one Coach turn that streams a scripted reply. Paper covers a CV edit and save that survives reload. Apply covers a card move between board columns and a URL scan that fills a card from the stubbed posting. Pitch covers publish and the public `/u/<slug>` page. Auth covers sign up and sign in. Sign-up seeds the starter workspace (`apps/api/src/auth.ts` line 80), so every drive starts with demo data and no extra seeding step.
- [ ] Prove the skill once, per step 4 of the create-verification-skill skill. Run launch, doctor, the Auth drive, capture evidence, run cleanup, and confirm the evidence dir still exists. Paste the path `/home/quan/tmp/opencv-verify/<run>/` into the PR body under the line `Evidence`.

**You see.**

- [ ] `bash .claude/skills/verify-opencv/scripts/launch.sh auth-proof` on a checkout with no database prints `READY api=<port> web=<port> run=auth-proof` and exits 0.
- [ ] `ls apps/api/.data/` shows `verify-auth-proof`, and `git status --short` prints nothing for it.
- [ ] `curl -s localhost:<api port>/api/session` after the scripted sign-up prints `{"ok":true,"user":{...},"session":{...}}`.
- [ ] The PR body has a line `Evidence /home/quan/tmp/opencv-verify/<run>/` and that directory lists `signup.png`, `signin.png`, `api.log`, `web.log` and `run.env` after cleanup ran.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/config.test.ts` gains `dbDriverFromEnv` cases (`pglite` returns `pglite`, ` pglite ` trims, blank, unset and `postgres` return `undefined`) and `pgliteDataDirFromEnv` cases (unset returns the default, a set value is trimmed). Red first because the exports do not exist, then green. Run `pnpm --filter api test -- config`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Start the api with `DB_DRIVER=pglite PORT=<free port> SESSION_SECRET=<32+ chars> pnpm --filter api dev` at trunk and at head, then run `curl -s -o /dev/null -w "%{http_code}" localhost:<port>/api/session` and a sign-up `POST /api/auth/sign-up/email`. If trunk lacks the feature, record that trunk answers 503 because `db` is undefined, and gate that head answers 401 on the bare session read and 200 on sign-up followed by `ok:true` with the user's email on `/api/session`. Save `trunk-vs-head-session.png`. Pass when trunk records 503 and head records 401, 200 and the email.
- [ ] Lane 2. Run `launch.sh lane2` from a checkout where `apps/api/.data/` does not exist. Save `launch-ready.png` of the terminal. Pass when the last line is `READY api=<port> web=<port> run=lane2`, the exit code is 0, `apps/api/.data/verify-lane2/` exists, and `api.log` contains no line with `error`.
- [ ] Lane 3. Run `doctor.sh lane2` while the stack is up, then `kill` only the recorded web PID and run `doctor.sh lane2` again. Save `doctor-green-red.png`. Pass when the first run prints only `PASS` lines and exits 0, and the second prints `FAIL web` and exits non-zero without touching the api.
- [ ] Lane 4. Sign up in the browser on `/sign-up`, run `cleanup.sh` on a copy of the stack that keeps its data dir (`KEEP_DATA=1`), relaunch with the same run id, and sign in on `/sign-in` with the same credentials. Save `restart-signin.png`. Pass when sign-in succeeds with no second sign-up, `/app` shows the starter workspace, and `api.log` shows no migration error on the second boot.
- [ ] Lane 5. Follow `features/auth.md` end to end with `agent-browser`. Save `auth-signup-signin.png`. Pass when sign-up lands on `/app`, signing out and back in lands on `/app`, and a wrong password shows an inline error without leaving `/sign-in`.
- [ ] Lane 6. Follow `features/home-coach-turn.md`. Send "Help me prepare for a product intern interview" in the Coach input on `/app`. Save `home-coach-turn.png`. Pass when a scripted assistant reply streams into the thread, the thread appears in the sidebar, `api.log` has no outbound request to `openrouter.ai`, and `OPENROUTER_API_KEY` is unset in `run.env`.
- [ ] Lane 7. Follow `features/paper-edit-save.md`. Open `/paper`, open the starter CV, change one bullet, wait for the save, reload. Save `paper-edit-saved.png`. Pass when the edited text is still in the editor after reload and `GET /api/paper` returns the new text.
- [ ] Lane 8. Follow `features/apply-board-and-scan.md`. On `/apply`, drag a starter card from one column to the next, then add a card with the posting URL `https://jobs.example.com/associate-pm-intern` and run the scan. Save `apply-move-scan.png`. Pass when the card sits in the new column after reload and the scanned card shows the stubbed title and company from the fake posting.
- [ ] Lane 9. Follow `features/pitch-publish.md`. On `/pitch`, publish, copy the slug from the share link, open `/u/<slug>` in a signed-out context. Save `pitch-public.png`. Pass when the public page renders the pitch headline and `GET /api/pitch/public/<slug>` returns 200.
- [ ] Lane 10. Run `cleanup.sh lane2`, then `cleanup.sh lane2` again. Save `cleanup-evidence.png`. Pass when both exit 0, `ss -ltn` shows neither recorded port, `apps/api/.data/verify-lane2/` is gone, `/home/quan/tmp/opencv-verify/lane2/` still lists every screenshot and both logs, and the head diff shows `apps/api/.data/` ignored.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Seconds from the start of `launch.sh` to the `READY` line, and seconds for `pnpm --filter api test` to finish. The first has no trunk value because trunk cannot launch without Postgres. The second exists at both sides.
- [ ] Probe. Run `time bash launch.sh perf-cold` after deleting `apps/api/.data/`, clean up, then `time bash launch.sh perf-warm` against a kept data dir. Run `time pnpm --filter api test` at trunk and at head, interleaved, three times each. Take the median.
- [ ] Baseline. Record the trunk median of `pnpm --filter api test` first (5 timeouts in `apps/api/src/apply/http.test.ts` are the known failures). Record that trunk has no cold launch value.
- [ ] Rule. Cold launch above 60 seconds or warm launch above 20 seconds fails. The head median of `pnpm --filter api test` more than 3 percent above trunk fails, because the PGlite branch must add nothing to the test path.

**Review gate.** None. PR-15 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Add the formal verification skill for the Apply scan URL guard (PR-16)

**Depends on.** PR-15.

**Files.**

- [ ] Create `.claude/skills/verify-apply-scan-guard/SKILL.md`.
- [ ] Create `apps/api/src/apply/fetch-posting.formal.test.ts`.
- [ ] Create `apps/api/vitest.formal.config.ts`.
- [ ] Edit `apps/api/vitest.config.ts` (add `**/*.formal.test.ts` to `exclude`, lines 4-10).
- [ ] Edit `apps/api/package.json` (add the `test:formal` script beside `test` at line 15 and the dev dependency `fast-check`).
- [ ] Edit `pnpm-lock.yaml`.

**Build.**

- [ ] Write `fetch-posting.formal.test.ts` against the real exports `assertPublicApplyScanUrl` (`apps/api/src/apply/fetch-posting.ts` line 69), `isBlockedApplyScanHost` (line 52) and `createFetchJobPosting` (line 97). The private `hostFromHttpUrl` (line 63) is reached through them, so no product export is added and no product code changes.
- [ ] Property 1, no bad URL reaches fetch. Build the real `createFetchJobPosting({ fetchImpl: spy, lookupImpl: null })` and also a variant with a lenient `lookupImpl` that always resolves to the public address `93.184.216.34`. With `fast-check`, generate a scheme from `http`, `https`, `ftp`, `file`, `javascript`, `data`, a userinfo from none, `user@` and `user:pw@`, an optional port, a path, and a host from loopback, link-local, private, CGNAT and `.localhost`, `.local`, `.internal` names plus the literals in `BLOCKED_HOSTS` (line 17). Assert `spy` was never called and the result is `ok:false`.
- [ ] Property 2, no public hostname is refused. Generate http and https URLs with any port and userinfo and a host from random DNS labels and random public IPv4 quads outside the private ranges in `isPrivateIPv4` (lines 24-39). Include the named regression hosts `fda.gov`, `fdic.gov` and `fcbarcelona.com`. Assert `assertPublicApplyScanUrl(url)` returns `ok:true`.
- [ ] Bounded exhaustive sweep. Enumerate the full product of 7 schemes, 3 userinfos, 3 ports (none, `:80`, `:8443`), 4 path tails (empty, `/x`, `?q=1`, `#f`) and a fixed host list of about 28 entries (21 blocked, 7 public). Assert the expected verdict for every tuple. The expected verdict is written once as a small table in the test, not derived from the code under test.
- [ ] Add `vitest.formal.config.ts` that includes only `src/**/*.formal.test.ts`, and exclude that glob from `vitest.config.ts` so `pnpm --filter api test` stays green on trunk while the check is red. The script is `"test:formal": "vitest run --config vitest.formal.config.ts"`. PR-5 deletes the exclusion when it turns the check green.
- [ ] Write `SKILL.md` with frontmatter `name: verify-apply-scan-guard` and a `description` naming the Apply scan SSRF boundary and when to use it (any change to `fetch-posting.ts` or to `openableApplyJobUrl` in `packages/domain/src/apply.ts` line 131). Sections are the property in one plain sentence, the harm in one sentence, why the tool was chosen, how to run, how to read a counterexample, bounds and assumptions, the coverage record, known findings, and the rule for moving the sync commit.
- [ ] Say in the skill that TypeScript has no production verifier for this code, so the tool is `fast-check` property tests over the real functions plus a bounded exhaustive sweep, and that a pass covers the generated and enumerated inputs, not every string.
- [ ] State the property as "No URL whose resolved host is loopback, link-local, private, or a non-http(s) scheme, with or without port or userinfo, ever reaches fetch, and no public hostname is refused." State the harm as "A job-posting URL aimed at the server's own network lets a user read internal services or cloud metadata through the Apply scan, and a wrong refusal blocks scans for real employers."
- [ ] Record two findings with counterexamples in the code's terms, not as weakened properties. F1 maps to api-quality finding 3. `isBlockedApplyScanHost("fda.gov")` returns true because `isPrivateIPv6` at line 44 runs on every hostname and `startsWith("fd")` matches, so `assertPublicApplyScanUrl("https://fda.gov/jobs/1")` returns `ok:false`. F2 maps to api-quality finding 4. `hostFromHttpUrl` (lines 63-67) keeps userinfo and port, so `assertPublicApplyScanUrl("http://user@127.0.0.1/x")` returns `ok:true` with no lookup, and with a lookup only a failing `dns.lookup("user@127.0.0.1")` stops it.
- [ ] Write the coverage record. Files `apps/api/src/apply/fetch-posting.ts` and `packages/domain/src/apply.ts`. Functions `isPrivateIPv4`, `isPrivateIPv6`, `isBlockedApplyScanHost`, `hostFromHttpUrl`, `assertPublicApplyScanUrl`, `createFetchJobPosting`, `openableApplyJobUrl`. Sync commit is the trunk SHA the PR branch was cut from (`git rev-parse origin/main` at PR time; `d722d6b0a4036abdf5bcdf37e2a14277803cc7b0` at planning time). The rule says to move the sync commit forward only after rereading the covered functions at the new commit, rerunning the check, and confirming every table row still describes the code.
- [ ] List what is not covered. DNS rebinding and single-address lookup (api-quality finding 6), the unbounded `arrayBuffer()` read (finding 5), redirect hops after the first, decimal or octal IPv4 forms such as `2130706433`, and IPv4-mapped IPv6 in hex form such as `::ffff:7f00:1`. If a later run probes one of these and it fails, it is a new finding, not a reason to shrink the grammar.
- [ ] Prove the skill on a scratch mutation per its own step. Delete the `a === 192 && b === 168` line (line 36) and confirm the check names a `192.168.x.y` counterexample. Revert and confirm the check is back to exactly F1 and F2. Repeat with the `.localhost` clause in `isBlockedApplyScanHost` and with the `https?` scheme test in `openableApplyJobUrl`.

**You see.**

- [ ] `pnpm --filter api test:formal` exits non-zero in under 10 seconds and prints exactly two failing tests, one with the counterexample `https://fda.gov/jobs/1` and one with `http://user@127.0.0.1/x`.
- [ ] `pnpm --filter api test` does not list `fetch-posting.formal.test.ts` and still shows the trunk baseline (384 pass, 5 time out at 5000 ms).
- [ ] With the `192.168` line deleted, `pnpm --filter api test:formal` prints a third failing test whose counterexample starts with `192.168.`, and after `git checkout apps/api/src/apply/fetch-posting.ts` it is back to two.
- [ ] `.claude/skills/verify-apply-scan-guard/SKILL.md` opens with frontmatter and its coverage record cites `fetch-posting.ts` lines 41, 52, 63 and 69.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/apply/fetch-posting.formal.test.ts` gains the two properties and the sweep. At trunk the file does not exist, so the first red is the missing file. Then it is red on F1 and F2 only, and the sweep reports the same two tuples. Run `pnpm --filter api test:formal`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm --filter api test` at trunk and at head. If trunk lacks the formal check, record that, and gate that head adds the `test:formal` script and that the default run lists the same 5 timeouts and no new failure. Save `default-suite-trunk-vs-head.png`. Pass when pass and fail counts match trunk apart from file totals.
- [ ] Lane 2. Run `pnpm --filter api test:formal` at head from a clean checkout. Save `formal-red-two.png`. Pass when the exit code is non-zero and the output names exactly two failing tests, labelled F1 and F2.
- [ ] Lane 3. Read the F1 counterexample as the skill says. Pass when the output contains `fda.gov` and the skill's "how to read a counterexample" section lets a reader name `isPrivateIPv6` line 44 from it. Save `counterexample-f1.png`.
- [ ] Lane 4. Read the F2 counterexample the same way. Save `counterexample-f2.png`. Pass when the output contains `user@127.0.0.1` and the result `ok:true`, and the skill points to `hostFromHttpUrl`.
- [ ] Lane 5. Time `pnpm --filter api test:formal` five times. Save `formal-timing.png`. Pass when every run is under 10 seconds wall and the sweep test reports the same tuple count each time.
- [ ] Lane 6. Scratch mutation A. Delete the `a === 192 && b === 168` line in `apps/api/src/apply/fetch-posting.ts`. Save `mutation-192-168.png`. Pass when the formal run has three failures and the new one's counterexample host starts with `192.168.`, and after `git checkout` of that file it returns to two.
- [ ] Lane 7. Scratch mutation B. Remove the `h.endsWith(".localhost")` clause in `isBlockedApplyScanHost`. Save `mutation-localhost.png`. Pass when a counterexample host ends in `.localhost`, and the revert returns the run to two failures.
- [ ] Lane 8. Scratch mutation C. In `packages/domain/src/apply.ts` change the `/^https?:\/\//i` test in `openableApplyJobUrl` to also accept `ftp://`. Save `mutation-scheme.png`. Pass when the scheme property fails with an `ftp:` counterexample, and the revert returns the run to two failures.
- [ ] Lane 9. Apply the two fixes from api-quality findings 3 and 4 on a scratch branch (call `isPrivateIPv6` only when the host contains `:`, and take the host from `new URL(openable).hostname`). Save `scratch-fix-green.png`. Pass when `pnpm --filter api test:formal` exits 0, which shows the property is satisfiable and no property was weakened. Discard the branch.
- [ ] Lane 10. Audit lane. Read `SKILL.md` cold. Run `git cat-file -e <sync SHA>`, `sed -n 41,45p`, `sed -n 52,54p`, `sed -n 63,67p` and `sed -n 69,71p` on `apps/api/src/apply/fetch-posting.ts`. Save `skill-audit.png` of the terminal. Pass when the SHA exists, every cited symbol is on its cited line, the frontmatter parses with `name` and `description`, and no placeholder text remains.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall seconds for `pnpm --filter api test:formal`, and wall seconds for `pnpm --filter api test` at trunk and at head.
- [ ] Probe. Run both commands three times each at head, and `pnpm --filter api test` three times at trunk, interleaved. Take medians. Trunk has no formal check, so the formal time is held to an absolute budget.
- [ ] Baseline. Record the trunk median of `pnpm --filter api test` first.
- [ ] Rule. Formal median above 10 seconds fails. Head `pnpm --filter api test` median more than 2 seconds above trunk fails.

**Review gate.** None. PR-16 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.

## Build the landing page (PR-17)

**Depends on.** PR-2, PR-9, PR-15.

**Files.**

- [ ] Edit `apps/web/src/router.tsx` (the `indexRoute` at lines 33-39).
- [ ] Create `apps/web/src/features/landing/landing-page.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-nav.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-hero.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-pillars.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-surface.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-footer.tsx`.
- [ ] Create `apps/web/src/features/landing/landing-copy.ts`.
- [ ] Create `apps/web/src/features/landing/landing.css`.
- [ ] Create `apps/web/src/features/landing/landing-page.test.tsx`.
- [ ] Create `apps/web/public/landing/coach.webp`, `apps/web/public/landing/paper.webp`, `apps/web/public/landing/apply.webp` and `apps/web/public/landing/pitch.webp`, with 390 px crops `coach-mobile.webp` and the matching names for the other surfaces.

**Build.**

- [ ] In `apps/web/src/router.tsx`, change `indexRoute` (line 33) so `beforeLoad` calls `authClient.getSession()` like `signInRoute` (lines 44-49), throws `redirect({ to: "/app" })` when `data` is set, and otherwise returns. Replace the unconditional throw at line 37. Add `component: lazyRouteComponent(() => import("@/features/landing/landing-page.tsx").then((m) => ({ default: m.LandingPage })))`, using the lazy pattern PR-9 sets for the other routes.
- [ ] `LandingPage` renders, in order, a nav, a hero, a pillar strip, four surface sections for Coach, Paper, Apply and Pitch, a CTA band and a footer. It has no logos, testimonials, pricing, changelog, how-it-works strip or language toggle, because ADR-0008 sets English only and the research (section 2.2 items 3, 7, 8, 9) says to leave unreal sections out.
- [ ] Nav shows the renamed logo (`OpenCvLogo` from `apps/web/src/features/app-shell/app-logo.tsx` after PR-2) with wordmark, links to the four surfaces as in-page anchors, a text `Sign in` link to `/sign-in`, and a kit `Button` `Start free` linking to `/sign-up`. The nav is transparent at the top and gains a blurred background after scroll with a 100 ms transition.
- [ ] Hero uses headline option B from the research (section 2.3), "The career coach that gets you your first job.", and the subhead "Chat with a coach, write your CV and letters, track every application, and share a portfolio page." The primary CTA is `Start free` to `/sign-up` and the secondary is `Sign in` to `/sign-in`. Only one filled button sits in the first viewport. Below the CTAs sits `coach.webp`, a real Coach screenshot.
- [ ] Heading type is the kit sans (`font-sans`, Geist Variable, the kit's Inter-class face) at 56 px on desktop and 40 px below the `md` breakpoint, weight 500, tight tracking, line height 1.1, with `text-wrap: balance`. The kit's `font-heading` is a serif, so the landing does not use it. The two sizes are declared once as `--landing-h1-desktop` and `--landing-h1-mobile` in `landing.css`. Every color, radius, border and spacing value elsewhere comes from kit tokens.
- [ ] Layout uses a 1344 px max width (`max-w-[1344px]`), 128 px vertical rhythm between sections on desktop and a smaller step on mobile, and 12 to 16 px panel radius from the kit radius tokens.
- [ ] Each surface section has a 2 to 4 word title (Coach, Paper, Apply, Pitch), one sentence from the research (section 2.4), and one real screenshot with alt text. The five screenshots (hero plus four surfaces) are captured through the `verify-opencv` skill from the seeded starter workspace at 1920 px wide. They are cropped with an edge-fade mask, saved as `.webp` under `apps/web/public/landing/`, and contain no personal data. The run's evidence path goes in the PR body.
- [ ] Theme is light, matching the app shell (the operator chose light on 2026-10-23). The landing uses the kit's light tokens as they are and adds no `dark` class. The dormant `.dark` block in `packages/ui/src/styles/globals.css` line 231 stays untouched.
- [ ] The hero image fades in over 0.8 s with a left-to-right mask sweep, defined in `landing.css` and gated by `@media (prefers-reduced-motion: no-preference)`. Under `reduce` the image is fully visible with no animation, and it is visible without JS. Hover transitions are 160 ms ease-out.
- [ ] A CTA band with two short declaratives and `Start free`, and a footer with the logo, the four surface links and `Sign in`. No invented columns or legal links.

**You see.**

- [ ] Signed out, `http://localhost:<web port>/` stays on `/` and shows an `h1` reading "The career coach that gets you your first job." At trunk the same request ends on `/sign-in?redirect=%2Fapp`.
- [ ] Signed in, `/` ends on `/app` with no landing flash.
- [ ] The page shows `h2` headings Coach, Paper, Apply, Pitch in that order, each above one screenshot, and the same light background token as `/sign-in`.
- [ ] `Start free` is a link with `href="/sign-up"` in the nav, the hero and the CTA band, and `Sign in` has `href="/sign-in"`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/features/landing/landing-page.test.tsx` gains cases for the headline text, the `Start free` and `Sign in` hrefs, the four surface headings in order, the absence of the words Pricing, Testimonials and any language control, an `alt` on every image, and a root element with the `dark` class. A second case mocks `authClient.getSession` (`apps/web/src/lib/auth-client.ts`) to return a session and asserts the index route `beforeLoad` throws a redirect to `/app`, and returns normally without one. Red first because the module does not exist, then green. Run `pnpm --filter web test -- src/features/landing`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open `/` signed out at trunk and at head with `agent-browser`. If trunk lacks the landing page, record that trunk redirects `/` to `/app` and then to `/sign-in?redirect=%2Fapp`, and gate that head keeps the URL at `/` and renders the `h1` and four surface headings. Save `trunk-vs-head-root.png`. Pass when trunk ends on `/sign-in` and head ends on `/` with the `h1` text from option B.
- [ ] Lane 2. Desktop at 1440 by 900, signed out, full-page screenshot. Save `landing-desktop.png`. Pass when the `h1`, then a pillar strip, then `h2` Coach, Paper, Apply, Pitch in that order, then the CTA band and the footer appear, and `document.body.innerText` contains none of Pricing, Testimonial, Changelog.
- [ ] Lane 3. Mobile at 390 by 844, signed out. Save `landing-mobile.png`. Pass when `document.documentElement.scrollWidth` is at most 390, the `h1` computed `font-size` is 40px, the hero `Start free` button is at least 358 px wide, and every screenshot fits its column.
- [ ] Lane 4. Sign up through the UI, then open `/` in the same session. Save `signed-in-redirect.png`. Pass when the final URL path is `/app` and the landing `h1` never appears in a snapshot taken right after navigation.
- [ ] Lane 5. Click each CTA signed out. Save `cta-links.png`. Pass when the nav, hero and band `Start free` links all land on `/sign-up`, the `Sign in` link lands on `/sign-in`, and each link's `href` attribute matches.
- [ ] Lane 6. Emulate `prefers-reduced-motion` once as `reduce` and once as `no-preference`. Save `reduced-motion.png`. Pass when under `no-preference` the hero image computed `animation-duration` is 0.8s with a mask, and under `reduce` its computed `animation-name` is `none` and `opacity` is 1.
- [ ] Lane 7. Keyboard only. Press Tab from the page top through the nav and hero. Save `keyboard-nav.png`. Pass when focus visits the logo, the surface links, `Sign in` and `Start free` in reading order, each focused element shows a visible focus ring (nonzero outline or ring shadow), and Enter on `Start free` lands on `/sign-up`.
- [ ] Lane 8. Run Lighthouse against `pnpm --filter web build` plus `pnpm --filter web preview`, in desktop and mobile modes, on `/`. Save `lighthouse.png` of the summary. Pass when performance and accessibility are both 90 or higher in both modes.
- [ ] Lane 9. Console and assets. Load `/` at 1440 and 390 with the console captured. Save `console-assets.png`. Pass when there are zero console errors and warnings, every `img` has `naturalWidth` above 0 and a non-empty `alt`, the five landing screenshots exist under `apps/web/public/landing/`, and the PR body links a `/home/quan/tmp/opencv-verify/<run>/` directory holding the capture run.
- [ ] Lane 10. Theme and layout. Read the landing root and then open `/sign-in`. Capture one landing render with `dark` and one with the class removed. Save `theme-dark-vs-light.png`. Pass when the landing root has class `dark` and a dark computed background, `/sign-in` has no `dark` class on `document.documentElement` and a light background, the `h1` computed `text-wrap` is `balance`, the content width is at most 1344 px, and the gap between two surface sections is 128 px at 1440.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. The landing route's initial JavaScript transfer size and its Lighthouse largest contentful paint, plus the signed-out `/app` entry JavaScript at trunk and at head.
- [ ] Probe. Build and preview trunk and head. Run Lighthouse mobile three times on `/` at head and on the signed-out `/app` entry at both. Interleave trunk and head. Read JS bytes from the `total-byte-weight` and network-requests audits, and LCP from the `largest-contentful-paint` audit. Trunk has no landing page, so the landing numbers use absolute budgets.
- [ ] Baseline. Record the trunk median for the signed-out `/app` entry JavaScript and LCP first. Trunk `/` redirects, so record that.
- [ ] Rule. Landing performance below 90, landing LCP above 2.5 seconds, or landing initial JavaScript above 200 kB transferred fails. The head `/app` entry JavaScript more than 2 percent above trunk fails, because landing code must load only on `/`.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 and lane 3 screenshots into `/home/quan/tmp/opencv-review/PR-17-review-desktop.png` and `/home/quan/tmp/opencv-review/PR-17-review-mobile.png`. Copy lane 10 into `/home/quan/tmp/opencv-review/PR-17-review-theme.png` so the operator sees dark and light and picks one.
- [ ] Record a 30 to 60 second video of the change on a lane worktree. Save it as `/home/quan/tmp/opencv-review/PR-17-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Remove every worktree under `/home/quan/projects/opencv.worktrees/` and every merged local branch, and list what was removed.
- [ ] Reply to the operator with the report the execution playbook names, with links to every PR, the trail, and the live URLs.

## Appendix A. Prototype evidence

No prototype ran before this plan. The questions below are empirical and get settled inside the PR that owns them, with the evidence recorded in the trail.

- Does Railway pass service variables as Docker build args so `VITE_API_URL` reaches the Vite build? Unproven. PR-3 settles it on the staging `web` service first (one deploy, read `apps/web/dist/assets/*.js` for the baked URL). Fallback is a runtime `window.__API_URL__` injected by Caddy from an env var.
- Does the Cloudflare proxy in front of `api.opencv.me` buffer the Coach SSE stream? Unproven. O3 adds the api records DNS-only, then PR-3's smoke (`pnpm --filter api smoke` against `https://api-staging.opencv.me`) is rerun once with the proxy on. Proxy stays off if the heartbeat check fails.
- Does `useEffectEvent` in React 19.2 clear the two `exhaustive-deps` warnings without changing autosave timing? Settled inside PR-11 by its unit box and the trunk-vs-head autosave lane.
- Does lazy-loading alone bring the largest chunk under 400 kB, or is a vendor split needed? Settled inside PR-9 by its perf probe, which measures before adding `manualChunks`.

## Appendix B. Alternatives rejected

- Renaming the Postgres schema `openpath_app` to `opencv_app`. Rejected. Production holds 26 legacy tables in that schema, drizzle-kit would diff a rename as drop plus create, and users see no difference. The name stays as an internal id with a comment at `apps/api/src/db/schema.ts:23`.
- Keeping the web on Vercel and only pointing `opencv.me` at it. Rejected because the operator asked to consolidate on Railway behind the Cloudflare zone. The cost is losing per-branch preview URLs. The `staging` environment stands in for previews.
- Cloudflare Pages for the web. Not chosen for the same reason. It stays the cheapest fallback if Railway static hosting disappoints (one zone, free previews).
- Keeping Storybook, locally or at `ui.opencv.me`. Removed outright on the operator's call (PR-18). The kit stays as source in `packages/ui`, and the ADR-0010 vocabulary test carries the governance that the Storybook build used to host.
- A separate marketing site (Astro or Next) for the landing page. Rejected. One SPA route, lazy-loaded, reuses the kit tokens and one deploy. A separate site earns its place only when the landing needs server rendering for SEO beyond what a static index with meta tags gives.
- A dark Linear-style landing. Rejected by the operator on 2026-10-23 in favor of light, so the landing matches the app shell and the kit needs no dark-mode work.
- Setting a custom Better Auth `cookiePrefix` during the rename. Rejected. It would log every user out for no benefit. Cookies already use the `better-auth` prefix independent of `appName`.
- A TLA+ model for the formal verification target. Rejected for this first target. The Apply scan URL guard is pure code with two proven bugs, so property tests on the real functions are true to the code and able to fail today. The Coach daily turn cap race (`apps/api/src/coach/usage.ts`) is the suggested second target and would suit TLA+.
- Renovate instead of Dependabot. Rejected. Dependabot needs no extra service.

## Appendix C. Risks

- Rulesets on a private repo may need a paid GitHub plan (O2b). If so, server-side protection is limited to the `ci` and `pr-title` checks plus the local hooks. Owner watches the `gh api` response and records the gap.
- The repo rename (O1) breaks any Railway or Vercel source link that does not follow GitHub's redirect. Owner watches the next Railway build after O1 and reconnects the source in the dashboard if it fails. The Vercel project `openpath-app` keeps serving the last deployment either way, which is what the overlap needs.
- The `AUTH_URL` flip (O4) logs every user out once. Owner announces it in the trail and schedules it with the operator.
- `railway.json` stops being read on 2026-12-01. PR-3 must land before then or the api service needs a manual config migration first.
- PR-5 changes the SSRF guard. A regression here is a security defect. PR-16's property check is the gate, and PR-5 may not weaken a property to pass.
- PR-13 rewrites the Coach turn state. The streamed-turn lanes (send, abort, regenerate, cap) at trunk and head are the gate. Owner is on `opus`.
- PR-12 and PR-17 move or add UI. Visual comparison lanes at trunk and head gate them. Owner watches CV template parity across all five templates.
- Dependabot opens PRs that trigger CI on every grouped update. Owner keeps the schedule weekly and grouped to limit noise.
- Local verification depends on the PGlite driver from PR-15. Until it merges, lanes write their own PGlite harness under `~/tmp`, which costs time per lane.

## Appendix D. Links and reading list

- Audit reports. `/home/quan/tmp/opencv-audit/api-quality.md`, `/home/quan/tmp/opencv-audit/web-quality.md`, `/home/quan/tmp/opencv-audit/infra-rename.md`, `/home/quan/tmp/opencv-audit/linear-landing-research.md`.
- Repo docs to read before editing. `AGENTS.md`, `CONTEXT.md`, `PRODUCT.md`, `docs/adr/0001-platform-and-stack.md`, `docs/adr/0006-data-foundation.md`, `docs/adr/0007-coach-runtime.md`, `docs/adr/0008-product-language.md`, `docs/adr/0010-design-tokens-and-governance.md`, `docs/railway.md`, `docs/deploy.md`.
- Skills in use. `/home/quan/.claude/skills/poteto-mode/SKILL.md`, `/home/quan/.claude/skills/swarm/SKILL.md`, `/home/quan/.claude/skills/create-verification-skill/SKILL.md`, `/home/quan/.claude/skills/create-formal-verification-skill/SKILL.md`, `/home/quan/.claude/skills/agent-browser/SKILL.md`, `/home/quan/.claude/skills/impeccable/SKILL.md` and `/home/quan/.claude/skills/emil-design-eng/SKILL.md` for PR-17, `/home/quan/.claude/skills/improve-codebase-architecture/SKILL.md` and `/home/quan/.claude/skills/codebase-design/SKILL.md` for PR-6, PR-8, PR-12, PR-13, `/home/quan/.claude/skills/tdd/SKILL.md` for PR-4, PR-5, PR-16.
- PRs that get `how` and `interrogate` before implementation. PR-3 (hosting layout), PR-13 (turn reducer), PR-16 (property set).
- Trail. `docs/plans/opencv-program-trail.md`, one row per tick and per decision, per the show-me-your-work skill.
- External. Railway custom domains https://docs.railway.com/networking/domains/working-with-domains, Railway React and Caddy guide https://docs.railway.com/guides/react, Railway IaC migration https://docs.railway.com/infrastructure-as-code#migrating-from-config-as-code, Cloudflare SSL modes https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/.
