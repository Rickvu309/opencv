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
