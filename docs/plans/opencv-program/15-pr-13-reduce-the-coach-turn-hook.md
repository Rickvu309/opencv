## Reduce the coach turn hook to one reducer (PR-13)

**Depends on.** PR-12.

**Files.**

- [ ] Edit `apps/web/src/features/coach/use-coach-turn.ts`.
- [ ] Create `apps/web/src/features/coach/turn-state.ts`.
- [ ] Create `apps/web/src/features/coach/turn-state.test.ts`.
- [ ] Edit `apps/web/src/features/coach/use-coach-turn.test.ts`.

**Build.**

- [ ] Name the state type first. In `apps/web/src/features/coach/turn-state.ts` export `type TurnState` as a union with four members keyed by `status`. `idle` carries `messages: HomeMessage[] | null` (the optimistic list, replacing `optimisticMessages` at use-coach-turn.ts:67). `streaming` carries `kind: "send" | "regenerate"`, `messages: HomeMessage[]` and `waiting: boolean` (true until the first delta, replacing the `TurnPhase` value `waiting`). `error` carries `kind`, `messages` and `error: SendError` (the type at line 38, which absorbs `regenerateError`). `aborted` carries `messages`. Export `type TurnAction` with `start`, `delta`, `finish`, `fail`, `abort` and `reset`, and `turnReducer(state, action)`.
- [ ] In `turn-state.ts` export `turnPhase(state): TurnPhase` that maps the reducer state onto the existing `"idle" | "waiting" | "streaming"` union from `@/features/home/thread-store-context.ts` (line 36) so the thread store and `coach-dock.tsx` stay unchanged.
- [ ] In `apps/web/src/features/coach/use-coach-turn.ts`, replace the four `useState` calls at lines 67 to 72 (`optimisticMessages`, `phase`, `sendError`, `regenerateError`) with one `useReducer(turnReducer, { status: "idle", messages: null })`. Keep `sendGeneration` and `abortRef` refs.
- [ ] In `use-coach-turn.ts`, extract one `runCoachStream` function used by `send` (starts at line 269) and `regenerate` (line 486). It takes the kind, the baseline message list (filtering `STREAMING_COACH_ID` and falling back to `toHomeMessages(detailQuery.data...)`, now written once instead of at lines 281 to 283 and 494 to 496), and the `AbortController`, and dispatches `delta`, `finish`, `fail` or `abort`. `hydrateThread` and `keepStreamedCoach` are called from this one loop.
- [ ] Reduce `send` and `regenerate` to building their own request and calling `runCoachStream`. `stop` (line 265) dispatches `abort`; `retry` (line 652) dispatches `reset` and re-runs. `rate` (line 662) and `undo` (line 694) stay as they are.
- [ ] Leave `writeDetail` (lines 98 to 115) and `rememberListItem` alone. The target is `use-coach-turn.ts` under 450 lines (trunk 720).
- [ ] Keep every value returned from `useCoachTurn` and every text from `coachSendErrorMessage` (`apps/web/src/features/home/coach-error.ts`) unchanged.

**You see.**

- [ ] `wc -l apps/web/src/features/coach/use-coach-turn.ts` prints under 450 (trunk 720), and `grep -c "useState" apps/web/src/features/coach/use-coach-turn.ts` prints 0.
- [ ] `pnpm --filter web exec vitest run src/routes/home-chat.test.tsx src/features/coach` prints all cases passing.
- [ ] A real streamed turn against the api shows the scripted reply "I looked at Apply. Prep the starred one next." in the thread.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/features/coach/turn-state.test.ts` is new. The cases are `idle` to `streaming` on `start`, `delta` clears `waiting`, `finish` returns to `idle` with the final messages, `fail` yields `error` with the mapped message, `abort` yields `aborted`, `reset` returns to `idle`, and a `delta` after `abort` is ignored. Red first (module missing), then green. Run `pnpm --filter web exec vitest run src/features/coach/turn-state.test.ts`.
- [ ] `apps/web/src/features/coach/use-coach-turn.test.ts` gains a case that regenerate after an aborted send leaves one assistant message, not two. Run `pnpm --filter web exec vitest run src/features/coach/use-coach-turn.test.ts`.
- [ ] Existing `apps/web/src/routes/home-chat.test.tsx` and the `apps/web/src/test/threads-api-mock.ts` scripts stay green without edits to either. Run `pnpm --filter web exec vitest run src/routes/home-chat.test.tsx` then `pnpm --filter web test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. With the api on `COACH_RUNTIME=fake`, sign up a fresh account, send "hello" from Home at trunk and at head. Save `pr13-streamed-turn-regression.png`. Pass when the reply "I looked at Apply. Prep the starred one next." renders at both, the Stop button is gone at the end, and the thread appears in the thread list.
- [ ] Lane 2. Abort mid-stream. Start a local delaying proxy under `~/tmp` that forwards to the api and pauses 500 ms between SSE chunks of `/api/threads/:id/coach`, point `VITE_API_URL` at it, send "hello", click the `Stop` button (aria-label "Stop") after the first text appears. Save `pr13-abort-midstream.png`. Pass when the stream stops, only the partial text remains, the composer is enabled again, and no error banner shows.
- [ ] Lane 3. Send after abort. Directly after lane 2, send "again". Save `pr13-send-after-abort.png`. Pass when a fresh full reply streams and the partial message from lane 2 is not duplicated.
- [ ] Lane 4. Regenerate. After a completed reply click `Regenerate` (aria-label "Regenerate"). Save `pr13-regenerate.png`. Pass when the last assistant message is replaced by a new reply and the thread still has exactly one assistant message for that turn.
- [ ] Lane 5. Abort during regenerate. With the delaying proxy, click Regenerate and then Stop mid-stream. Save `pr13-regenerate-abort.png`. Pass when the composer re-enables with no error banner and no duplicated assistant message.
- [ ] Lane 6. Daily cap error. Start the api with `COACH_DAILY_TURN_LIMIT=1` (and the per-mode caps from `.env.example` lines 73 to 75 set to 1), send two messages. Save `pr13-daily-cap.png`. Pass when the second send shows "You've reached today's limit for this Coach mode. Try another mode, or come back tomorrow." and the first reply is still on screen.
- [ ] Lane 7. Retry after error. Stop the api during a send so it fails with the network message, restart it, press Retry. Save `pr13-retry-after-error.png`. Pass when "Couldn't reach the Coach. Check your connection and try again." shows first and the retry produces the scripted reply.
- [ ] Lane 8. Reload mid-thread. After two turns reload the page and reopen the thread. Save `pr13-reload-hydration.png`. Pass when both turns hydrate from the api in order with no duplicated or missing message.
- [ ] Lane 9. Coach float in Paper. Open the Coach float, send "hello", abort, regenerate. Save `pr13-coach-float-turn.png`. Pass when the float thread behaves like Home with no console error.
- [ ] Lane 10. Audit lane. Run `grep -c "setPhase\|setSendError\|setRegenerateError\|setOptimisticMessages" apps/web/src/features/coach/use-coach-turn.ts` at trunk and head and the `turn-state.test.ts` run. Save `pr13-state-audit.png`. Pass when trunk prints 55 or more setter calls in total, head prints 0, and the reducer tests are green.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Line count of `use-coach-turn.ts`, and time from clicking send to the full scripted reply on screen with the fake runtime.
- [ ] Probe. At trunk and at head, interleaved, run `wc -l apps/web/src/features/coach/use-coach-turn.ts`, then send "hello" five times through `agent-browser` and record the time from click to the text "Prep the starred one next." visible, taking the median.
- [ ] Baseline. Record the trunk values first. The audit measured 720 lines.
- [ ] Rule. Fail if head is above 450 lines, or if the head median reply time is more than 100 ms slower than trunk.

**Review gate.** None. PR-13 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
