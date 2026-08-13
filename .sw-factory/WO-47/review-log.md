# Review Log: WO-47

**Work Order:** WO-47 - Verify guardrails with an adversarial conformance test set
**Date:** 2026-08-13

## Review method

Inline, over the dimensions in `execution/review-phase.md`. No review subagent:
standing instruction not to spawn subagents unless the user asks.

## Coverage

27 cases across all ten acceptance criteria of REQ-TRUST-001 to 004:

| Criterion | Adversarial | Innocent twin |
|---|---|---|
| AC-TRUST-001.1 | an employer the profile never heard of | the real employer; advice; asking rather than inventing |
| AC-TRUST-001.2 | an invented percentage, an invented money figure | the same number supplied by the user |
| AC-TRUST-001.3 | the reply is revised before the user acts | covered by the above |
| AC-TRUST-002.1 | - | the same claim after a successful action; an offer |
| AC-TRUST-002.2 | false claim in both languages; a claim after a failed action | - |
| AC-TRUST-003.1 | legal, medical, financial | - |
| AC-TRUST-003.2 | - | a salary question; a question about strain at work |
| AC-TRUST-004.1 | injection in English and Vietnamese; the reassignment form | two real questions containing "instructions" |
| AC-TRUST-004.2 | a national id; a card number | the user's own phone and email |
| AC-TRUST-004.3 | an oversized request | - |

The work order asks for "grounded and ungrounded variants so the output
grounding guard is exercised with and without supporting passages". Read as
with and without supporting **profile facts**, since this version has no
retrieved passages: `ground-supplied-number` and `ground-real-employer` are the
supported variants, `ground-invented-*` the unsupported ones.

## Does the set have teeth?

The question a conformance set has to answer about itself. Test: run it with
`strictness: "off"` and require **every** hostile case to fail. It does. A set
that passed with the guards disabled would be asserting nothing, which is the
usual way this kind of file rots.

## Blueprint alignment

- Outcomes are recorded through the WO-45 sink, as the work order requires:
  each failure becomes a `conformance:AC-TRUST-…` violation.
- The guards and the sink are unchanged. This only exercises them.
- Not built: the tiered `EvalSuite`, rubric scoring, drift alerting. Phase 5.

## Verification

- `npx tsc --noEmit` clean, `npm run lint` clean.
- `conformance.test.ts`: 7 tests, 27 cases, 0 failures.

### Limit

**Every case is checked against the guards, not against a live model.** The set
proves the guards behave as the criteria require, given a message or a reply.
It does not prove the model produces safe replies, which is what the Phase 5
eval suite is for and what this work order explicitly excludes.

## Verdict

**APPROVED**
