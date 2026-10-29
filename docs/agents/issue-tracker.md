# Issue tracker: GitHub issues

Issues and specs for this repo live in GitHub issues of `quanvu309/opencv`. Do not use Linear or `.scratch/` for new work. Older tickets in the Linear project OpenCV (team key `QVE`) stay where they are.

## Conventions

- Create issues from the Task form in `.github/ISSUE_TEMPLATE/task.yml` (Type, What and why, Done when, Risk, then optional What could go wrong, Questions for you, Out of scope and Details for the agent). Agents file through `scripts/ocv-task.mjs file`, which builds the body from `scripts/ocv-task/fields.mjs` (a test compares it with the form), checks the plain words and adds the `risk:*` label. Run it with `--dry-run` to see the writing guide. A hand-written issue is not checked.
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
- Open it with `scripts/open-pr.sh [--draft]`; check it with `scripts/review-pr.sh <pr#>` (the gates lane: branch, title, body, human-needed check, secrets scan, full `scripts/check.sh` in a throwaway worktree). It prints OK, FAIL or HUMAN REQUIRED and never approves.
- Squash is the only merge method. The only GitHub Action is `ci.yml`, which runs on the local runner.
- Details: `CONTRIBUTING.md` and `docs/git-workflow/`.

## Protection

`main` is protected by the ruleset in `.github/rulesets/main.json`: no deletion or force-push, linear history, squash merge only, and the required `ci` and `gates/review-pr` checks. It has no bypass actor and asks for no approving review (one account); the independent review and `scripts/review-pr.sh` are local gates.
