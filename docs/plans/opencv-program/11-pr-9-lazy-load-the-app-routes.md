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
