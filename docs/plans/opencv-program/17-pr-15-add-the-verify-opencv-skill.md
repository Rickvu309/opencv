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

- [ ] `apps/api/src/config.test.ts` gains `dbDriverFromEnv` cases (`pglite` returns `pglite`, `pglite` trims, blank, unset and `postgres` return `undefined`) and `pgliteDataDirFromEnv` cases (unset returns the default, a set value is trimmed). Red first because the exports do not exist, then green. Run `pnpm --filter api test -- config`.

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
