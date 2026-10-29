# Issue tracker: GitHub issues

Issues and specs for this repo live in GitHub issues of `quanvu309/opencv`. Do not use Linear or `.scratch/` for new work. Older tickets in the Linear project OpenCV (team key `QVE`) stay where they are.

## Conventions

- Create issues from the Task form in `.github/ISSUE_TEMPLATE/task.yml` (Type, What and why, Done when, Risk, then optional What could go wrong, Questions for you, Out of scope and Details for the agent). Agents file through `scripts/ocv-tools.mjs file`, which builds the body from `scripts/ocv-tools/fields.mjs` (a test compares it with the form), checks the plain words and adds the `risk:*` label. Run it with `--dry-run` to see the writing guide. A hand-written issue is not checked.
- Read an issue with `gh issue view <number>`; list open work with `gh issue list`.
- Labels come from `.github/labels.yml`: the type labels (`feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`), `needs-human-review`, `ready-for-human`, and `risk:low`, `risk:normal`, `risk:high` (only `risk:high` needs the owner's `/approve`). `docs/agents/triage-labels.md` maps the triage roles to what replaces them. `node scripts/pr.mjs doctor` diffs GitHub against the file.
- Assign yourself before you start. One issue is one branch is one PR.

## When a skill says "publish to the issue tracker"

Create a GitHub issue with `gh issue create`, labeled with its type.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number>` (or open the URL).

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single GitHub issue with **child** issues as tickets.

- **Map**: one issue labelled `wayfinder:map`, holding Notes / Decisions-so-far / Fog.
- **Child ticket**: a sub-issue of the map; label `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`).
- **Blocking**: a `Blocked by: #<n>, #<n>` line near the top of the child body.
- **Frontier**: open children of the map with no open blockers and unclaimed; first in map order wins.
- **Claim**: assign to the driving session or user before work.
- **Resolve**: comment the answer, close the issue as completed or not planned, then append a context pointer to the map's Decisions-so-far.

## Pull requests

- Branch: `type/<issue#>-short-description`, for example `feat/42-login-page`.
- Title: `type: description (#<issue>)`. It becomes the squash commit subject on `main`.
- Body: `.github/pull_request_template.md`, with `Closes #<issue>`.
- Open it with `scripts/open-pr.sh [--draft]`. Merge it with `scripts/merge-pr.sh <pr#>` once the `ci` check on the head is green. The script refuses a draft, another author, and a `needs-human-review` label.
- Squash is the only merge method. The only GitHub Action is `ci.yml`, which runs on the local runner.
- Details: `CONTRIBUTING.md` and `docs/git-workflow/`.

## Protection

`main` is protected by the ruleset in `.github/rulesets/main.json`: no deletion or force-push, linear history, squash merge only, and the required `ci` check. It has no bypass actor and asks for no approving review (one account).

## ocv-tools jobs

`scripts/ocv-tools.mjs help` lists every job. The ones for working an issue:

- `take <n>` makes the worktree (branch, port, `.env`, hooks, install; it replaces the old new-task script) and records your claim in an issue comment. Refused: NOT_AN_ISSUE, CLOSED, HELD, NEEDS_APPROVAL (risk:high only), WORKTREE_EXISTS, ASSIGNED (`--take` overrides), READY_FOR_HUMAN, DISK. Given a title instead of a number it files the issue first.
- `save -m <message>` commits, pushes through the pre-push check and refreshes the claim. A claim idle for 180 minutes can be taken over; the old holder's next save exits 3 (LOST) and writes a patch under `~/tmp/ocv-tools/lost/`.
- `release --reason <why>` gives the issue back. Only the holder can.
- `cleanup [<n>]` removes the worktree and branch after the merge (it replaces the old cleanup script). Refused: DIRTY, NOT_MERGED. `--all`, `--dry-run` and `--force` as before.
- `status <n>` also shows who holds the claim and how long it has been idle.
- `shot <file...>` uploads png, jpg, gif and webp pictures to the `screenshots` release (a prerelease, created when missing) and posts them on this task's issue, or on `--pr` / `--issue`. `--no-comment` only uploads. Pictures are never committed. At most 20 pictures, each at most 10 MB (`TOO_MANY`, `TOO_BIG`), checked before anything is copied or uploaded. A long comment is split under 60000 characters. Staging copies are removed after the upload, including when the upload fails. Refused: MISSING_FILE, BAD_PICTURE, TOO_BIG, TOO_MANY.
- `board` lists every open issue grouped as waiting for approval, open and free, taken, idle and in review, with the claim holder, idle minutes, pull request and checks. Open pull requests are read in full. Checks are the latest `ci` check run on that pull request. `--json` prints the same groups.
- `approve <n>` posts `/approve` on a `risk:high` issue after the owner said approved in chat. Any other risk is refused (`NOT_HIGH_RISK`: no approval is needed). The signed-in account must be the repository owner (`NOT_OWNER`); take only accepts that account's `/approve`. A second valid approve does nothing.
