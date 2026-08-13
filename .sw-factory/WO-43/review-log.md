# Review Log: WO-43

**Work Order:** WO-43 - Build input guard and non-grounding output checks around the Coach turn
**Date:** 2026-08-13

## Review method

Inline, over the dimensions in `execution/review-phase.md`. No review subagent:
this agent operates under a standing instruction not to spawn subagents unless
the user asks.

## Acceptance criteria

| Criterion | How it is met | Test |
|---|---|---|
| AC-TRUST-002.1 | A claim of change with a successful tool result is allowed | `output.test.ts` |
| AC-TRUST-002.2 | A claim with no successful result is revised with a correction that says it did not happen | `output.test.ts` |
| AC-TRUST-003.1 | Legal, medical and financial questions are declined and redirected to careers, with no model call | `input.test.ts` |
| AC-TRUST-003.2 | Out-of-scope answers are short and steer back; the reply names careers | `input.test.ts` |
| AC-TRUST-004.1 | Injection is refused in the browser and again in the eve channel | `input.test.ts`, `server.test.ts` |
| AC-TRUST-004.2 | National id, card and password are redacted before sending; anything still carrying them at the server is refused | `input.test.ts`, `server.test.ts` |
| AC-TRUST-004.3 | A request with no room for a reply is refused | `budget.test.ts` |

## Blueprint alignment

- `InputGuard` and `OutputGuard` are the two named components, in the container
  the blueprint puts them in (the input guard's enforcing half runs in the eve
  channel; the output guard runs where the reply is, in the browser).
- Destructive-action confirmation is **not** reimplemented. It stays with the
  action registry, as the blueprint requires, and this capability only reports.
- The per-session cap stays in the router (WO-40). This owns prompt-level
  accounting only, which is the split the blueprint spells out.
- `GuardrailConfig` is read as configuration, so strictness can later be varied
  by @Feature Flags & Experiments.
- Violations go to the WO-45 sink from both sides.

### Documented deviation

**The output guard revises rather than blocks.** The reply streams into view
before the turn ends, so by the time both the text and the tool results are
known, the user has read it. A true block would mean buffering the whole reply
and giving up the streaming the product is built around. The correction is
appended instead, which is also what a person would do on realising they had
misspoken. The `block` variant exists in the type and is unused.

## What the tests found

Seven of the first twenty-nine tests failed, all from one bug: **`\b` does not
form a word boundary around Vietnamese letters.** `\b` is defined against ASCII
`\w`, so `/\b(đầu tư)\b/` never matches anything, and most of the Vietnamese
patterns in the first draft were dead code that would have passed review by
inspection. They now use Unicode lookarounds.

That is the whole argument for testing a guard rather than reading it: a
regex that never fires looks exactly like a regex that never needed to.

A second finding: `/\b(bỏ qua|quên)\b.../` refused "mình quên hướng dẫn nộp hồ
sơ rồi" (I forgot the application instructions), which is a real question from a
real user. The Vietnamese injection patterns now require a word pointing at the
Coach's own instructions.

## False positives

The failure mode this feature can actually cause. Every rule has a negative
test beside it:

- a question mentioning "instructions" innocently, in both languages
- the user's own phone number and email, which a CV builder holds on purpose
- salary and workload questions, which are about money and health and are
  squarely in scope
- "I can add that" and "should I update your CV", which offer rather than claim
- an honest estimate ("about three months"), which is not an over-promise

## Verification

- `npx tsc --noEmit` clean, `npm run lint` clean.
- `lib/guardrails/*`: 33 tests, 0 failures.
- `eve dev` boots to `[eve:dev] server listening` with the new `onMessage` hook.
  This is the check that caught a dead agent in an earlier work order.
- Full suite: 3 pre-existing tests needed updating for the new migration and the
  copy budget, and were fixed rather than excluded.

### Exploratory pass

Against `next dev` with a real account: a reported violation is stored, read
back with the account resolved from the session rather than the body, an empty
report is refused 400, and an unauthenticated one 401. The test account was
deleted afterwards.

**Not verified live:** a complete Coach turn through the guards, because the
provider key is not in this working copy and no local turn can reach a model.
The server guard is instead tested directly against a real migrated schema,
which also proves the recording that a curl would not have.

## Verdict

**APPROVED**
