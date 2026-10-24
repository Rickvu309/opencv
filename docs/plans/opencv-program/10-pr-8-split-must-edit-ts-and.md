## Split must-edit.ts and coach/http.ts along their seams (PR-8)

**Depends on.** PR-7.

**Files.**

- [ ] Edit `apps/api/src/coach/must-edit.ts`.
- [ ] Create `apps/api/src/coach/must-edit-intent.ts`.
- [ ] Create `apps/api/src/coach/focus-doc.ts`.
- [ ] Create `apps/api/src/coach/tool-dump.ts`.
- [ ] Create `apps/api/src/coach/rewrite.ts`.
- [ ] Create `apps/api/src/coach/replacement-text.ts`.
- [ ] Edit `apps/api/src/coach/http.ts`.
- [ ] Create `apps/api/src/coach/sse.ts`.
- [ ] Create `apps/api/src/coach/turn.ts`.

**Build.**

- [ ] Pure moves only. No signature, name, regex or string changes. Do the move with cut and paste, then fix imports, then run the suite. The PR body states the line ranges moved.
- [ ] Create `coach/must-edit-intent.ts` from `must-edit.ts` lines 30-160 (`isPaperEditAsk`, `latestUserText`, `mustEditTurnInstruction`, `mustEditToolChoice`, `mustEditPrepareStep`, `mustEditStillNeedsUpdate`, `toolNamesFromSteps` and the `MUST_EDIT_TOOLS` types).
- [ ] Create `coach/focus-doc.ts` from lines 167-310 (`toCoachFocusDoc`, `describeFocusDoc`, `namesExperienceOrBullet`, `namedOtherCvSection`, `describeExperienceRoles`).
- [ ] Create `coach/tool-dump.ts` from lines 307-403 (`isToolDumpText`, `stripToolDumpText`).
- [ ] Create `coach/rewrite.ts` from lines 516-610 and 771-866 (`findFocusRewriteOriginal`, `applyRewriteToFocusContent`, `localRewriteText`, `isRealRewrite`, `shouldUseFreeTextMustEdit`, and the locate and apply helpers). Move the miss-copy functions at lines 404-515 (`textNamesExperienceRole`, `isExperienceNamedMiss`, `mustEditMissCopy`, `mustEditNoRewriteCopy`) into `coach/must-edit.ts` itself, which keeps the barrel plus that cohesive remainder.
- [ ] Create `coach/replacement-text.ts` from lines 636-770 (`freeMustEditLinePrompt`, `stripMustEditThinking`, `sanitizeMustEditLine`, `extractMustEditReplacement`).
- [ ] Keep `coach/must-edit.ts` exporting every symbol it exports today through `export * from "./must-edit-intent.js"` and the same for the other new files, so no importer and no test file changes. Check for a circular import with `pnpm --filter api exec madge` or a `tsc` run, and fix by moving shared constants to the lower file.
- [ ] Create `coach/sse.ts` from `coach/http.ts` lines 664-738 (`isDisconnected`, `waitForAbort`, `takeUntilAbort`, `writeEvent`, `writeHeartbeat`), exported.
- [ ] Create `coach/turn.ts` from `coach/http.ts` lines 391-662 (`RunCoachTurnOptions`, `runCoachTurn`, `applyStreamPart`, `sseDataForPart`, `persistCoachTurn`), importing from `./sse.js`, and export `runCoachTurn`.
- [ ] Leave `coach/http.ts` as routes only, about 390 lines, importing `runCoachTurn` from `./turn.js`. Its three routes at lines 88, 252 and 320 stay in place.

**You see.**

- [ ] `wc -l apps/api/src/coach/http.ts` prints 400 or fewer, down from 738, and `wc -l apps/api/src/coach/must-edit.ts` prints 250 or fewer, down from 866, with no new file above 300 lines.
- [ ] `pnpm --filter api test src/coach` prints the same number of passing tests as trunk, including the 727-line `must-edit.test.ts` untouched, and `git diff --stat` shows `must-edit.test.ts` and `http.test.ts` with 0 changed lines.
- [ ] `git diff -M --color-moved=dimmed-zebra` shows the moved blocks as moved, with changes only in `import` and `export` lines.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add `apps/api/src/coach/must-edit-exports.test.ts` that imports `* as barrel from "./must-edit.js"` and asserts the sorted list of export names equals the list captured from trunk (the list is committed in the test file). Red is not possible for a pure move, so the proof is that it is written and passes at trunk first, then passes at head. Run `pnpm --filter api test src/coach/must-edit-exports.test.ts`.
- [ ] Existing coach suites pass unchanged at head. Run `pnpm --filter api test src/coach`.
- [ ] The existing `apps/api/src/coach/aisdk-isolation.test.ts` passes as is, which shows the new `turn.ts` does not import the AI SDK. Run `pnpm --filter api test src/coach/aisdk-isolation.test.ts`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Start the PGlite api with `COACH_RUNTIME=fake`, sign up, and `curl -N -X POST /api/threads/<id>/coach` with a valid body, at trunk and head. Save `pr8-regression.png`. Pass when the SSE event names, their order and the `data:` payload shapes match, with only ids and timestamps differing.
- [ ] Lane 2. Heartbeat. Start the head api with a short heartbeat through the harness option `coachSseHeartbeatMs: 200` in a `~/tmp` driver and `curl -N` a turn that the fake runtime holds open. Save `pr8-heartbeat.png`. Pass when at least one heartbeat frame appears before the message end event.
- [ ] Lane 3. Client disconnect. `curl -N --max-time 1` a turn, then read the thread. Save `pr8-disconnect.png`. Pass when the server log shows no unhandled rejection, the process stays up, and `GET /health` is 200 afterwards.
- [ ] Lane 4. Feedback route. `POST /api/threads/<id>/messages/<messageId>/feedback` with a rating after a completed turn. Save `pr8-feedback.png`. Pass when the response is 200 `"ok":true` at trunk and head.
- [ ] Lane 5. Reverse route. `POST /api/threads/<id>/messages/<messageId>/reverse` on a message with a reversible receipt, signed in as the owner and then as another user. Save `pr8-reverse.png`. Pass when the owner gets the same status as trunk and the other user gets 404 or 403 as at trunk.
- [ ] Lane 6. Web UI, streamed reply. Using `agent-browser` with the web per the boot recipe and the fake runtime, sign up, open the Welcome thread, send "Hello". Save `pr8-ui-turn.png`. Pass when the reply streams in and finishes with no error banner.
- [ ] Lane 7. Web UI, must-edit flow. Open Paper, create or open a CV doc, ask the Coach "fix my summary" with the doc focused, using the fake runtime. Save `pr8-ui-must-edit.png`. Pass when the Coach answers in the thread without a crash and the network log shows the coach POST completing with 200.
- [ ] Lane 8. Barrel check from the built output. Run `pnpm --filter api build` then `node -e` importing `dist/coach/must-edit.js` and printing `Object.keys(...).length` at trunk and head. Save `pr8-barrel.png`. Pass when the key counts are equal.
- [ ] Lane 9. Circular import check. Run `pnpm --filter api exec tsc --noEmit` and `npx madge --circular apps/api/src/coach` from the repo root. Save `pr8-circular.png`. Pass when typecheck exits 0 and madge reports no circular dependency that trunk lacks.
- [ ] Lane 10. Line count and moved-block audit. Run `wc -l` on the nine files and `git diff -M --stat main...HEAD`. Save `pr8-moves.png`. Pass when `http.ts` is at most 400 lines, `must-edit.ts` at most 250, no new file exceeds 300, and total inserted lines minus deleted lines is under 80 (imports and headers only).

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of `pnpm --filter api typecheck` and of `pnpm --filter api test src/coach`, in seconds.
- [ ] Probe. Run `/usr/bin/time -f %e` on each command five times at trunk and five at head, interleaved, with the `tsc` build info removed before each typecheck run. Both sides produce the metric.
- [ ] Baseline. Record the trunk medians first.
- [ ] Rule. Head medians must be within 5 percent of trunk's for both commands. A head median more than 5 percent slower fails the PR.

**Review gate.** None. PR-8 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
