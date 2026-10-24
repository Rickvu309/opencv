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
