# Review Log: WO-46

**Work Order:** WO-46 - Build output grounding guard against profile facts
**Date:** 2026-08-13

## Review method

Inline, over the dimensions in `execution/review-phase.md`. No review subagent:
standing instruction not to spawn subagents unless the user asks.

## Acceptance criteria

| Criterion | How it is met | Test |
|---|---|---|
| AC-TRUST-001.1 | An assertion about the user that traces to nothing in the profile is flagged, and the correction tells the user to check it rather than deleting it | `grounding.test.ts` |
| AC-TRUST-001.2 | A measurable result absent from both the profile and the conversation is flagged; one the user supplied is not | `grounding.test.ts` |
| AC-TRUST-001.3 | The reply is revised before the user acts on it, with the doubt named | `grounding.test.ts` |

## Blueprint alignment

- `OutputGuard`'s grounding check, grounding against profile facts in
  `AppState`, exactly as ADR-002 specifies.
- Market-claim grounding is **not** built. ADR-002 puts it out of scope for
  this version, and the work order repeats it: there is no retrieved corpus to
  check against.
- Findings go to the WO-45 sink through the same client reporter WO-43 uses.

### Documented deviation

Same one as WO-43: **revise rather than block**, because the reply has streamed
by the time the check can run. Here it is arguably the better behaviour
regardless: the user is the only person who knows whether the claim is true,
and deleting the sentence would take away the thing they need to judge.

## What the tests found

**A false negative that would have shipped.** The first version compared
numbers by their digits, so "4.0" and "40%" normalised to the same string. The
fixture profile's only number is a GPA of 4.0, which meant an invented "40%"
was silently accepted as grounded. Comparison is now by parsed value.

That is the second time in this phase that a guard which read correctly was
wrong in a way only a test could see.

## False positives

The failure mode that matters. Each has a test:

- ordinary numbers in advice ("3 tháng nữa", "2 projects", "5 người") are not
  results and are not flagged
- a GPA or a figure already in the profile is grounded
- a number the user typed this conversation is grounded
- advice ("bạn có thể học SQL", "you could apply to a startup") states nothing
  about the user and is not a claim
- a question asking the user for an example is not a claim

## Verification

- `npx tsc --noEmit` clean, `npm run lint` clean.
- `lib/guardrails/grounding.test.ts`: 13 tests, 0 failures.
- Wired into the finished turn in `components/coach/thread.tsx`, next to the
  action-honesty check, reading the same `AppState` the screens render from.

### Limit

**Not exercised against a live model turn**, for the same reason as WO-40 and
WO-43: no provider key in this working copy. The check is pure and takes a
reply and a state, so the test coverage is the substance of it; what is not
proven locally is the wiring, which the deploy verification covers.

## Verdict

**APPROVED**
