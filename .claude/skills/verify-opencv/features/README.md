# OpenCV verification map

This directory is the maintained source for verifying the user-facing behavior of OpenCV. Read this index, then follow the matching feature file as the recipe.

## Baseline preconditions

- A stack launched by `scripts/launch.sh <run>` and a green `scripts/doctor.sh <run>`.
- Load `WEB_URL`, `API_URL` and `EVIDENCE_DIR` from `~/tmp/opencv-verify/<run>/run.env`.
- Use your own `agent-browser` session. Every feature except Auth starts signed in as a freshly signed-up user (see `auth.md`). A new account is empty. The feature file creates the CV, cards, or thread it drives.
- Never drive an instance that was not started by this run.

## Driving conventions

- Prefer ARIA roles and accessible names over CSS selectors or element refs. Refs (`@eN`) change on every render.
- Run `agent-browser snapshot -i` after each page change to confirm the state before the next action.
- Read stored state back through the api with `agent-browser eval "fetch('<API_URL>/api/...',{credentials:'include'}).then(r=>r.text())"`.
- Save screenshots to `$EVIDENCE_DIR` and name them after the feature.
- The Coach reply and the Apply scan posting are scripted, so assert on their fixed text, never on model quality.

## Features

| File                      | Feature                                  | Entry           |
| ------------------------- | ---------------------------------------- | --------------- |
| `auth.md`                 | Sign in by code, sign out, sign in       | `/sign-in`      |
| `shell.md`                | Sidebar, dock, chat panel, drawer        | `/app`          |
| `coach.md`                | Coach page, history, and the shell panel | `/app/coach`    |
| `paper-edit-save.md`      | Create a CV, edit it, reload             | `/app/paper`    |
| `apply-board-and-scan.md` | Add a card, move it, scan a posting URL  | `/app/apply`    |
| `coming-soon.md`          | Jobs, Proofs and Pitch coming soon       | `/app/jobs`     |
| `settings.md`             | Settings sections, export, upgrade       | `/app/settings` |
| `inbox.md`                | Inbox connect, scan, read, reply         | `/app/inbox`    |

## Proof and skip reporting

- Capture the action and the resulting state, not only the final screen.
- Mutation proof includes a second view of the stored value (reload or api read).
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path.
