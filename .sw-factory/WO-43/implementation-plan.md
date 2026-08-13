# Implementation Plan: WO-43

**Work Order:** WO-43 - Build input guard and non-grounding output checks around the Coach turn
**Requirements:** REQ-TRUST-002, REQ-TRUST-003, REQ-TRUST-004
**Blueprints:** AI Guardrails, Trustworthy Coach

## Problem

Today the product's hardest rules are asked for in `agent/instructions.md` and
hoped for. "Never claim a change you did not make" is a paragraph the model
reads, and a paragraph is not an enforcement. AI Guardrails ADR-001 says so
directly: honesty rules enforced ad hoc "cannot guarantee grounding or catch a
false action claim".

## Where the guards run, and why there

The blueprint puts both guards in the Coach Agent container. This product's turn
runs inside eve, which owns its own model call, so there are two places code of
mine can stand:

1. **`agent/channels/eve.ts`, the `onMessage` hook.** Server-side, pre-dispatch,
   cannot be bypassed by a modified client. This is where a blocked input is
   refused, by throwing before a model call is made or billed.
2. **The browser, in `components/coach/thread.tsx`.** Before sending, and after
   the turn ends.

Both. The server-side check is the enforcement; the client-side one is what
gives the user an honest sentence instead of a failed turn, and it costs no
model call to produce.

The output guard can only run in the browser, because the reply is streamed
there and eve owns the stream. It runs on the finished turn, when both the text
and the tool results are known, which is exactly what the action-honesty check
needs.

## Files

### `lib/guardrails/config.ts`

`GuardrailConfig` with a `strictness` of `off` | `standard` | `strict`, read
from `OPENPATH_GUARDRAILS`. The blueprint requires strictness be readable as
config so @Feature Flags & Experiments can vary it later.

### `lib/guardrails/input.ts` - the `InputGuard`

`screenInput({ text, config })` returns one of four verdicts:

- `allow`
- `redact` - the text with sensitive data replaced, plus the violations
- `redirect` - out of scope; carries the decline-and-redirect reply, so
  AC-TRUST-003.1 is answered without a model call
- `refuse` - injection, or over budget

Checks:

- **Injection** (AC-TRUST-004.1). Bilingual patterns for the family of "ignore
  your instructions / you are now / print your system prompt". A match is a
  refusal, not a redaction: an instruction to disregard instructions has no
  benign reading in a career coaching app.
- **Sensitive data** (AC-TRUST-004.2). Deliberately narrow: national id numbers,
  bank and card numbers, and anything typed after "mật khẩu"/"password". Names,
  emails and phone numbers are **not** touched, because a CV builder that
  redacts the user's own phone number is broken rather than safe.
- **Scope** (AC-TRUST-003.1). Legal, medical and personal-financial requests are
  declined and redirected to career guidance.

### `lib/guardrails/budget.ts`

`estimateTokens(text)` and `fitsBudget(...)` (AC-TRUST-004.3). The prompt-level
accounting the blueprint assigns to the input guard: the message plus the
serialized `CoachContext`, against what the session has left, with room reserved
for a reply. The per-session cap itself stays where WO-40 put it.

### `lib/guardrails/output.ts` - the non-grounding `OutputGuard` checks

`checkOutput({ reply, toolCalls, config })`:

- **Action honesty** (AC-TRUST-002). A reply that says a change was made, with
  no successful tool result in the turn, is revised: the claim is struck and
  replaced with a sentence saying it did not happen. This is the check the
  product cannot do without; the instruction file has asked for it since the
  beginning and nothing has ever verified it.
- **Scope and tone.** A reply that gives legal, medical or financial advice, or
  promises an offer or a salary, is flagged.

Grounding against profile facts is **not** here. That is WO-46.

### Emission

Every violation goes to the sink from WO-45: server-side through a collector
bound by `withTrace`, client-side by posting the violation with the turn's
trace. A guard that refuses silently cannot be measured, and the blueprint is
explicit that the guards' own accuracy is measured rather than assumed.

### i18n

Every sentence a user can see is a `{ vi, en }` pair in `lib/i18n/messages.ts`
under a `guardrails` block, like every other string in the product.

## Testing

Per acceptance criterion, with the cases designed to pass and the cases designed
to fail:

- injection in both languages is refused; a sentence containing the word
  "instructions" innocently is not
- a national id is redacted; a phone number in a CV is not
- a legal question is redirected, and the redirect names careers
- an oversized prompt is refused before a model call
- a reply claiming "mình đã thêm" with no tool result is revised; the same
  sentence with a successful tool result is allowed
- `strictness: "off"` allows everything, so the flag is real

## Risks

- **False positives are the failure mode.** A guard that refuses real questions
  is worse than none, because the user cannot tell it apart from a broken
  product. Every pattern is narrow, and every check has a negative test proving
  an innocent sentence survives.
- **The output guard sees the reply after it has streamed.** It revises rather
  than blocks. A true block would need buffering the whole reply, which trades
  the streaming the product is built around for a guarantee the revise already
  delivers.
