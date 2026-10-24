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
