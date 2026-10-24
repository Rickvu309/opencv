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
