## Replace effect workarounds with useEffectEvent and one storage helper (PR-11)

**Depends on.** PR-10.

**Files.**

- [ ] Edit `apps/web/src/features/paper/paper-editor.tsx`.
- [ ] Edit `apps/web/src/features/coach/coach-thread.tsx`.
- [ ] Edit `apps/web/src/features/paper/coach-float.tsx`.
- [ ] Edit `apps/web/src/features/home/aim-prompt.ts`.
- [ ] Edit `apps/web/src/features/home/first-cafe-checklist.ts`.
- [ ] Edit `apps/web/src/test/paper-seam.test.ts`.
- [ ] Create `apps/web/src/lib/local-storage.ts`.
- [ ] Create `apps/web/src/lib/local-storage.test.ts`.
- [ ] Create `apps/web/src/lib/use-flash.ts`.
- [ ] Create `apps/web/src/lib/use-flash.test.tsx`.

**Build.**

- [ ] In `apps/web/src/lib/local-storage.ts`, export `readStored<T>(key: string, parse: (raw: string | null) => T, fallback: T): T` and `writeStored(key: string, value: string): void`. Both wrap `window.localStorage` in `try/catch` and fall back (read) or stay session-only (write) when storage is blocked.
- [ ] In `apps/web/src/features/paper/paper-editor.tsx`, replace `readDocsPanel` and `writeDocsPanel` (lines 95 to 108) with `readStored(DOCS_PANEL_KEY, ...)` that accepts only `"expanded"` or `"collapsed"`, and `writeStored`. Keep `DOCS_PANEL_KEY` at `"openpath:paper:docs-panel"` (line 90).
- [ ] In `apps/web/src/features/paper/coach-float.tsx`, replace `readFloatState` and `writeFloatState` (lines 213 to 230) the same way, accepting `"closed"`, `"open"` and `"minimized"` with fallback `"closed"`. Keep `COACH_FLOAT_STORAGE_KEY` (line 51).
- [ ] In `apps/web/src/features/home/aim-prompt.ts`, replace the `try/catch` pair `readAimPromptState` and `writeAimPromptState` (lines 112 to 125) with `readStored(aimPromptStorageKey(userId), parseAimPromptState, { resolved: false, aimId: null })` and `writeStored(..., JSON.stringify(state))`. Keep the exported function names.
- [ ] In `apps/web/src/features/home/first-cafe-checklist.ts`, do the same for `readFirstCafeState` and `writeFirstCafeState` (lines 221 to 230) with fallback `{ ...EMPTY_FIRST_CAFE_STATE }`.
- [ ] In `apps/web/src/lib/use-flash.ts`, export `useFlash(ms: number): [boolean, () => void]` that sets a boolean true on trigger and resets it after `ms` with a cleared timer on unmount and on re-trigger.
- [ ] In `apps/web/src/features/coach/coach-thread.tsx`, replace the duplicated `undoneFlash` state plus timer effect in `ReceiptPart` (lines 204 to 210) and `CoachBoundBody` (lines 391 to 397) with `useFlash(UNDO_FLASH_MS)`. Replace `copied` in `MessageActions` (line 255) with `useFlash(2000)`. This makes the Copy button reset after 2 seconds, matching the Apply copy button; on trunk it stays pressed.
- [ ] In `apps/web/src/features/paper/paper-editor.tsx`, import `useEffectEvent` from `react` and wrap `persistOpenDoc` (line 333) so the autosave timer effect (lines 364 to 375) and the unmount flush effect (lines 377 to 382) call the event function without listing it. Keep their dependency lists as the retrigger conditions only.
- [ ] In `apps/web/src/features/paper/paper-editor.tsx`, wrap `applyServerDoc` (line 206) in `useEffectEvent` and delete the `eslint-disable-next-line react-hooks/exhaustive-deps` comment at line 263. Keep `[doc.id, doc.updatedAt, isCv, isProof, revertKey]` as the deps.
- [ ] In `apps/web/src/test/paper-seam.test.ts`, replace the case at lines 35 to 42 ("persists the documents panel inline without a storage helper"), which forbids a storage helper by regex, with a rendered case that collapses the documents panel in `renderApp("/app/paper")`, reads `localStorage.getItem("openpath:paper:docs-panel")`, remounts, and asserts the panel stays collapsed. Model it on `apps/web/src/routes/paper.test.tsx` lines 2493 to 2505.

**You see.**

- [ ] `pnpm --filter web lint` prints no warnings and no errors (trunk prints 2 warnings, `react-hooks/exhaustive-deps` at paper-editor.tsx:375 and :382).
- [ ] `grep -rn "eslint-disable" apps/web/src | wc -l` prints 0.
- [ ] `grep -rn "localStorage" apps/web/src --include=*.ts --include=*.tsx -l | grep -v test` lists `apps/web/src/lib/local-storage.ts` and no feature file.
- [ ] Clicking Copy on a Coach reply shows the pressed state for about 2 seconds, then it clears.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/lib/local-storage.test.ts` is new. The cases are a valid stored value is returned, an invalid value returns the fallback, `getItem` throwing returns the fallback, `setItem` throwing does not throw. Red first (module missing), then green. Run `pnpm --filter web exec vitest run src/lib/local-storage.test.ts`.
- [ ] `apps/web/src/lib/use-flash.test.tsx` is new, using fake timers. The cases are that the flag is true right after trigger, false after `ms`, a second trigger restarts the timer, unmount clears it without a state-update warning. Run `pnpm --filter web exec vitest run src/lib/use-flash.test.tsx`.
- [ ] `apps/web/src/test/paper-seam.test.ts` carries the rewritten behavior case and passes. Run `pnpm --filter web exec vitest run src/test/paper-seam.test.ts`.
- [ ] Existing storage and autosave tests stay green in `apps/web/src/routes/paper.test.tsx`, `apps/web/src/routes/home-chat.test.tsx`, `apps/web/src/routes/home.test.tsx`. Run `pnpm --filter web test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Sign up a fresh account, create a letter document in Paper, type "abc", wait 1.2 seconds, type "def", wait 1.2 seconds, reload, at trunk and at head. Save `pr11-letter-autosave-regression.png`. Pass when the reloaded document reads "abcdef" at both and the caret did not reset between the two typing bursts.
- [ ] Lane 2. Unmount flush. Type "flush me" in a letter document and within 300 ms (before the 700 ms autosave timer) click Home in the sidebar, then return to the document. Save `pr11-unmount-flush.png`. Pass when "flush me" is present.
- [ ] Lane 3. CV autosave. Open the starter CV, edit the summary field, wait 1.2 seconds, reload. Save `pr11-cv-autosave.png`. Pass when the edited summary survives the reload.
- [ ] Lane 4. Documents panel storage. Collapse the documents panel, reload, then set `localStorage["openpath:paper:docs-panel"]` to `junk` with `agent-browser` and reload. Save `pr11-docs-panel-storage.png`. Pass when the panel is collapsed after the first reload and expanded after the corrupt value, and the key still reads `collapsed` after the first step.
- [ ] Lane 5. Coach float storage. Open the Coach float in Paper, reload, then set `localStorage["openpath:paper:coach-float"]` to `junk` and reload. Save `pr11-coach-float-storage.png`. Pass when the float is open after the first reload and closed after the corrupt value.
- [ ] Lane 6. Home aim prompt and first cafe checklist. Resolve the aim prompt and tick one checklist item, reload. Save `pr11-home-storage.png`. Pass when the aim prompt stays resolved, the tick stays, and `localStorage` keys starting `openpath:home:aim-prompt` and `openpath:home:first-cafe-checklist` exist.
- [ ] Lane 7. Blocked storage. In a private-mode style session where `localStorage.setItem` throws (override it with `agent-browser` eval before load), open Paper and collapse the panel. Save `pr11-blocked-storage.png`. Pass when the panel collapses for the session and no error overlay or console exception appears.
- [ ] Lane 8. Copy flash. With the api on `COACH_RUNTIME=fake`, send "hello" in the Coach float, click Copy on the reply, snapshot immediately and again after 2.5 seconds. Save `pr11-copy-flash.png`. Pass when `aria-pressed="true"` shows in the first snapshot and is absent in the second; record that trunk stays pressed.
- [ ] Lane 9. Audit lane for the undo flash. The fake script has no reversible receipt, so run `pnpm --filter web exec vitest run src/routes/home-chat.test.tsx` and read the undo case. Save `pr11-undo-flash-test.png`. Pass when the undo and receipt cases are green and the source shows one `useFlash` call per former `undoneFlash`.
- [ ] Lane 10. Lint and disable audit. Run `pnpm --filter web lint` and `grep -rn "eslint-disable" apps/web/src` at trunk and head and screenshot the terminal. Save `pr11-lint-zero.png`. Pass when trunk prints 2 warnings and 1 disable line and head prints no warnings and no disable line.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. ESLint warning count from `pnpm --filter web lint` and total gzip JS bytes from `pnpm --filter web build`.
- [ ] Probe. At trunk and at head, interleaved, run `pnpm --filter web lint 2>&1 | grep -c warning` and `pnpm --filter web build`, then sum `gzip -c <file> | wc -c` over `apps/web/dist/assets/*.js`.
- [ ] Baseline. Record the trunk values first. The audit measured 2 warnings and a 367.35 kB gzip single chunk.
- [ ] Rule. Fail if head prints any warning, or if head gzip JS is more than 0.5 percent above trunk.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 8 screenshots into `/home/quan/tmp/opencv-review/PR-11-review-copy-flash.png`.
- [ ] Record a 30 to 60 second video of the change on a lane worktree. Save it as `/home/quan/tmp/opencv-review/PR-11-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
