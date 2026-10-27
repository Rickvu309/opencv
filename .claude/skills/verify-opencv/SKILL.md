---
name: verify-opencv
description: Launch OpenCV locally (Vite web SPA plus the Hono api, PGlite database, scripted Coach, no network or tokens), drive real user paths in a browser, capture proof, and tear it down. Use when a change touches apps/web or apps/api and you need to show it works, or when asked to verify, smoke-test, or screenshot OpenCV.
---

# verify-opencv

Runs the real web app and api on this machine with no Postgres, no Docker and no remote service. The api uses an embedded PGlite database in `apps/api/.data/verify-<run>/`. Coach replies come from the scripted demo runtime (`COACH_RUNTIME=fake`), and the Apply URL scan reads a fixed posting. A run never touches Railway, Cloudflare or OpenRouter.

Run id: any `[A-Za-z0-9._-]+` string you choose. Each run gets its own two free ports and its own data dir, so two runs can coexist. Never drive a stack you did not start.

All paths below are relative to the repo (or worktree) root.

## Launch

```bash
bash .claude/skills/verify-opencv/scripts/launch.sh <run>
```

- Prints `READY api=<port> web=<port> run=<run>` and exits 0 only after `GET /health` returns `{"ok":true}`, a probe sign-in by email code succeeds, and the web root answers 200. Any other outcome prints `launch failed: <reason>` plus the log tails, cleans up what it started, and exits 1.
- Writes `~/tmp/opencv-verify/<run>/run.env` (ports, pids, process groups, data dir, head SHA) and appends to `api.log` and `web.log` in that directory.
- Cold start takes about 25 s, warm start about 10 s on an idle machine. `LAUNCH_WAIT_SECONDS` (default 240) bounds each readiness wait. `OPENCV_API_PORT` and `OPENCV_WEB_PORT` pin the ports.
- The launch environment unsets `OPENROUTER_API_KEY`, `DATABASE_URL` and `NODE_ENV`, so the run cannot reach a real model or database.
- Needs `pnpm install` done in this checkout first.

## Doctor

```bash
bash .claude/skills/verify-opencv/scripts/doctor.sh <run>
```

Read-only. One `PASS <check>` or `FAIL <check>` line per check: `api-pid`, `api-owned`, `api-port`, `web-pid`, `web-owned`, `web-port`, `health`, `session` (401 or 200, never 503), `web`, `head` (checkout HEAD equals the SHA recorded at launch), `data-dir`. Exits non-zero on any FAIL. Run it before driving and again before capturing proof.

Editing files under `apps/api/src` while the stack is up makes `tsx watch` respawn the api with a new pid, so `api-pid` fails. Committing changes `head`. Either way, run cleanup and launch again.

## Drive

Use the `agent-browser` skill with its own named session (`export AGENT_BROWSER_SESSION=verify-<run>`). Load `$WEB_URL` from `run.env` (`set -a; . ~/tmp/opencv-verify/<run>/run.env; set +a`). Prefer ARIA roles and accessible names: `agent-browser find role button click --name "Continue"`.

Routes: `/sign-in`. `/sign-up` redirects to `/sign-in`. `/app` redirects to the start page, Apply by default. `/app/paper`, `/app/apply`, `/app/coach`, `/app/inbox`, `/app/settings` (Preferences, plus `/app/settings/coach`, `/app/settings/integrations`, `/app/settings/usage`, `/app/settings/billing`, `/app/settings/billing/upgrade`, and `/app/settings/account`). `/app/jobs`, `/app/proofs` and `/app/pitch` are coming soon. `/app/proof` redirects to `/app/proofs`. Signed-out visits to `/app/*` redirect to `/sign-in?redirect=...`. `/u/$slug` and unknown paths are the calm 404.

The first email code creates an empty account. It does not seed a CV, Apply cards, a Pitch, or a welcome thread. Each feature recipe creates the records it drives. Brand text may change between branches, so assert on behavior and accessible names, not the product name.

Open `features/README.md`, pick the feature file for what changed, and follow its recipe:

- `features/auth.md`
- `features/shell.md`
- `features/home-coach-turn.md`
- `features/paper-edit-save.md`
- `features/apply-board-and-scan.md`
- `features/coming-soon.md`
- `features/settings.md`
- `features/inbox.md`

A proof that drives one convenient entry point is incomplete when the feature file lists others.

## Evidence

Everything goes under `~/tmp/opencv-verify/<run>/` (the `EVIDENCE_DIR` in `run.env`): screenshots (`agent-browser screenshot <name>.png`), the two logs, `run.env`, and any response bodies.

The evidence root defaults to `~/tmp/opencv-verify`. Set `OPENCV_VERIFY_ROOT=<dir>` for `launch.sh`, `doctor.sh` and `cleanup.sh` alike to use another root; every path above then lives under `<dir>/<run>/`.

Proof standards:

- Exercise the real user path in the browser, not internal setters or test-only endpoints.
- Capture the action and the resulting state, not just the final screen.
- Verify side effects alongside what is visible: reload and re-read, or read the stored value back from the api (`fetch` with `credentials: 'include'` through `agent-browser eval`), and check `api.log` and `web.log`.
- The only mocks are the production boundaries already isolated: the scripted Coach runtime and the stub posting fetch. Say so in the report.
- A step you did not drive is reported as not driven, not as passed.

## Cleanup

```bash
bash .claude/skills/verify-opencv/scripts/cleanup.sh <run>
```

Stops only the processes recorded in `run.env` (matched by process group and the `OPENCV_VERIFY_RUN` marker, never by name), then removes `apps/api/.data/verify-<run>/`. The evidence dir is never touched. Safe to run twice. `KEEP_DATA=1` keeps the data dir so a relaunch with the same run id sees the same accounts. Run cleanup after every failed attempt too, then close the browser session (`agent-browser close`).

After cleanup, `ls ~/tmp/opencv-verify/<run>/` must still list the proof files.

## Helpers

- Failed launch: read the `api.log:` and `web.log:` tails it printed. If PGlite fails with `ErrnoError` on first boot under heavy machine load, retry with a larger `LAUNCH_WAIT_SECONDS`.
- Port in use: choose other ports with `OPENCV_API_PORT` and `OPENCV_WEB_PORT`, or let the script pick.
- Run already live: `launch.sh` refuses a run id whose processes are still up. Run cleanup or pick a new id.
- `apps/api/.data/` is gitignored. The skill folder is un-ignored in `.gitignore`.
- `DB_DRIVER=pglite` is refused when `NODE_ENV=production`, so it cannot reach a deploy.
