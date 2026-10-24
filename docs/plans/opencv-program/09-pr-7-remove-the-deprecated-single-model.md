## Remove the deprecated single-model Coach path (PR-7)

**Depends on.** PR-6.

**Files.**

- [ ] Edit `apps/api/src/config.ts`.
- [ ] Edit `apps/api/src/config.test.ts`.
- [ ] Edit `apps/api/src/app.ts`.
- [ ] Edit `apps/api/src/coach/http.ts`.
- [ ] Edit `apps/api/src/index.ts`.
- [ ] Edit `apps/api/src/coach/bind.ts`.
- [ ] Edit `apps/api/src/coach/bind.test.ts`.
- [ ] Edit `apps/api/src/coach/runtime.ts`.
- [ ] Edit `apps/api/src/coach/fake.ts`.
- [ ] Edit `apps/api/src/coach/domain.test.ts`.
- [ ] Edit `apps/api/src/coach/deploy-docs.test.ts`.
- [ ] Edit `apps/api/src/coach/eval/report.test.ts`.
- [ ] Edit `apps/api/src/test/harness.ts`.
- [ ] Edit `packages/domain/src/coach.ts`.
- [ ] Edit `docs/railway.md`.
- [ ] Edit `.env.example`.

**Build.**

- [ ] Migrate callers first, delete second, all in this one wave. In `packages/domain/src/coach.ts`, make `resolveCoachModel(mode, env)` take a required `CoachMode`, delete the `if (!mode)` branch that reads `COACH_MODEL` (lines near 66-68), delete `COACH_MODEL` from `CoachModelEnv` (line 40-41), delete `COACH_DAILY_TURN_LIMIT` from `CoachDailyTurnLimitEnv`, delete the global-cap step in `resolveCoachDailyTurnLimit` so only the per-mode env then the mode default apply, and delete `DEFAULT_COACH_MODEL` (lines 13-14) and `DEFAULT_COACH_DAILY_TURN_LIMIT`. Keep `DEFAULT_COACH_MODELS` and `DEFAULT_COACH_DAILY_TURN_LIMITS`.
- [ ] In `apps/api/src/config.ts`, delete `coachModelFromEnv` (lines 69-75) and `coachDailyTurnLimitFromEnv` (lines 86-100) and the now unused `DEFAULT_COACH_DAILY_TURN_LIMIT` import at line 2.
- [ ] In `apps/api/src/app.ts`, delete `coachModel` and `coachDailyTurnLimit` from the options type (lines 41-45), the destructure (line 62) and the `createCoachRoutes` call (line 124).
- [ ] In `apps/api/src/coach/http.ts`, delete `coachModel` and `coachDailyTurnLimit` from `CoachRouteOptions` (line 67) and the destructure (line 80). Reduce lines 179-186 to `const model = coachModels?.[mode] ?? resolveCoachModel(mode)` and `const limit = coachDailyTurnLimits?.[mode] ?? DEFAULT_COACH_DAILY_TURN_LIMITS[mode]`, and remove the `DEFAULT_COACH_DAILY_TURN_LIMIT` import at line 12.
- [ ] In `apps/api/src/index.ts`, delete the `coachModelFromEnv` and `coachDailyTurnLimitFromEnv` imports and the `coachModel` constant (line 33), and stop passing `coachModel` (lines 46 and 57) and `coachDailyTurnLimit` to `createApp`.
- [ ] In `apps/api/src/coach/bind.ts`, delete `coachModel` from `CoachRuntimeConfig` (line 14) and the destructure (line 27), and the `model: coachModel ?? DEFAULT_COACH_MODEL` line (39). In `apps/api/src/coach/runtime.ts`, make `model` a required option or drop it and use `input.model` only. The `streamTurn` line `input.model ?? model` (near line 113) becomes `input.model`, since `coach/http.ts` always sets `model` at its call. Remove the `DEFAULT_COACH_MODEL` import at line 7 and the default at line 78.
- [ ] In `apps/api/src/coach/fake.ts` line 35, replace `DEFAULT_COACH_MODEL` with `DEFAULT_COACH_MODELS.free`. In `apps/api/src/test/harness.ts`, delete `coachModel` and `coachDailyTurnLimit` from `createTestApp` options and the `createApp` call (lines 35 and 50 and neighbors).
- [ ] Tests follow the code. In `config.test.ts` delete the `coachModelFromEnv` describe (lines 98-112) and the `coachDailyTurnLimitFromEnv` describe (lines 125-152). In `coach/domain.test.ts` delete `uses deprecated COACH_MODEL only when mode is unset` (lines 285-292), the `DEFAULT_COACH_MODEL` expectation at line 58, the `DEFAULT_COACH_DAILY_TURN_LIMIT` expectation at line 60, and the global-cap assertions near lines 316-320. Replace `DEFAULT_COACH_MODEL` in `coach/translate.test.ts`, `coach/bind.test.ts` and `coach/eval/report.test.ts` with a mode default.
- [ ] In `coach/deploy-docs.test.ts` remove `"COACH_MODEL"` (line 19) and `"COACH_DAILY_TURN_LIMIT"` (line 23) from the required list and drop the `COACH_DAILY_TURN_LIMIT=50` expectation (line 39). Keep the per-mode names and the `.env.example` check.
- [ ] In `docs/railway.md` delete the `COACH_MODEL` row (line 48) and the `COACH_DAILY_TURN_LIMIT` row (line 52). In `.env.example` delete the sentence about the deprecated fallback (lines 61-62), `# COACH_MODEL=...` (line 68) and `# COACH_DAILY_TURN_LIMIT=50` (line 73).
- [ ] Ops step in the PR body. If Railway has `COACH_MODEL` or `COACH_DAILY_TURN_LIMIT` set on staging or production, they are removed in the same step. After removal the per-mode variables decide everything.

**You see.**

- [ ] `grep -rn "coachModelFromEnv\|COACH_MODEL\b\|COACH_DAILY_TURN_LIMIT\b\|DEFAULT_COACH_MODEL\b" apps packages docs .env.example --include=*.ts --include=*.md --include=.env.example` prints no match (per-mode names like `COACH_MODEL_FREE` do not match the `\b` pattern).
- [ ] Booting with `COACH_MODEL=openai/legacy COACH_DAILY_TURN_LIMIT=1` changes nothing. A Free turn is recorded in `coach_usage` with `model` equal to `openrouter/free`, and a second turn the same day still succeeds.
- [ ] `docs/railway.md` lists `COACH_MODEL_FREE`, `COACH_MODEL_LIGHT`, `COACH_MODEL_MAX` and the three per-mode limits, and no legacy row.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api/src/coach/domain.test.ts` gains `ignores COACH_MODEL and COACH_DAILY_TURN_LIMIT`, calling `resolveCoachModel("free", { COACH_MODEL: "x" } as never)` and `resolveCoachDailyTurnLimit("free", { COACH_DAILY_TURN_LIMIT: "1" } as never)` and expecting the mode defaults. Red first at trunk (the global cap of 1 wins in the limit case), green after. Run `pnpm --filter api test src/coach/domain.test.ts`.
- [ ] `apps/api/src/coach/deploy-docs.test.ts` still passes with the shorter name list, and gains `does not document the removed variables` expecting neither file to contain `COACH_DAILY_TURN_LIMIT=` or a `| COACH_MODEL |` row. Red first, then green. Run `pnpm --filter api test src/coach/deploy-docs.test.ts`.
- [ ] Full api and domain suites. Run `pnpm --filter api test` and `pnpm --filter @workspace/domain test`, plus `pnpm typecheck` at the repo root so the web app, which imports the domain package, still compiles.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Start the PGlite api with `COACH_RUNTIME=fake`, sign up with curl, read the Welcome thread id from `GET /api/threads`, and `curl -N -X POST /api/threads/<id>/coach` with a minimal body that satisfies `coachTurnRequestSchema` (`packages/domain/src/threads.ts:93`), at trunk and head. Save `pr7-regression.png`. Pass when the SSE event names and order are identical at trunk and head, ending with the message end event.
- [ ] Lane 2. Legacy variables are inert. Start the head api with `COACH_MODEL=openai/legacy COACH_DAILY_TURN_LIMIT=1 COACH_RUNTIME=fake`, run two Free turns by curl. Save `pr7-legacy-inert.png`. Pass when both turns complete with HTTP 200 and the second is not the `coachLimitReachedEnvelope` 429.
- [ ] Lane 3. Per-mode limit still enforced. Start the head api with `COACH_DAILY_TURN_LIMIT_FREE=1 COACH_RUNTIME=fake`, run two Free turns. Save `pr7-mode-limit.png`. Pass when the first answers 200 and the second answers 429 with the `COACH_LIMIT_REACHED` envelope.
- [ ] Lane 4. Per-mode model env. Start the head api with `COACH_MODEL_LIGHT=openai/test-light`, a stub OpenRouter endpoint, and `OPENROUTER_API_KEY=test`, then run a Light turn. Save `pr7-light-model.png`. Pass when the captured request body has `"model":"openai/test-light"` and `coach_usage` stores that model for the turn.
- [ ] Lane 5. Default model per mode. Start the head api with no model variables and the same stub, and run one Free, one Light and one Max turn. Save `pr7-default-models.png`. Pass when the stub sees `openrouter/free`, `deepseek/deepseek-chat-v3.1` and `anthropic/claude-opus-4` in that order.
- [ ] Lane 6. Web UI, send a message. Using `agent-browser` with the web per the boot recipe and the fake runtime, sign up, open the Welcome thread, send "Hello", wait for the reply. Save `pr7-ui-coach-turn.png`. Pass when a streamed Coach reply is visible and no error banner shows.
- [ ] Lane 7. Web UI, mode switch. In the same session switch the mode from Free to Light and send another message. Save `pr7-ui-mode-switch.png`. Pass when the second reply renders and the mode chip shows Light.
- [ ] Lane 8. Boot without a key. Start the head api with no `OPENROUTER_API_KEY` and no `COACH_RUNTIME`, then `curl -i /health` and a signed-in coach POST. Save `pr7-no-key.png`. Pass when health is 200 and the coach POST is 503 `COACH_UNAVAILABLE`.
- [ ] Lane 9. Docs read-back. Render `docs/railway.md` (the Coach table) and `.env.example` lines 55-75 at head with `sed -n`. Save `pr7-docs.png`. Pass when neither shows `COACH_MODEL` as a standalone name or `COACH_DAILY_TURN_LIMIT` without a `_FREE`, `_LIGHT` or `_MAX` suffix.
- [ ] Lane 10. Whole-repo gates. Run `pnpm typecheck`, `pnpm lint`, `pnpm --filter api test`, `pnpm --filter web test`. Save `pr7-gates.png`. Pass when typecheck and lint exit 0 (lint keeps the 2 baseline web warnings), api shows 0 failed, and web shows 478 passed and 1 skipped.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of `pnpm --filter api typecheck` in seconds, plus the count of lines under `apps/api/src` and `packages/domain/src/coach.ts`.
- [ ] Probe. Run `/usr/bin/time -f %e pnpm --filter api typecheck` five times at trunk and five at head, interleaved, each with `tsc` incremental output removed first. Both sides produce the metric.
- [ ] Baseline. Record the trunk median first.
- [ ] Rule. Head median must not exceed trunk's by more than 3 percent, and head must have fewer lines than trunk. Fail otherwise.

**Review gate.** None. PR-7 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
