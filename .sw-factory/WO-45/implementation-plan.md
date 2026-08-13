# Implementation Plan: WO-45

**Work Order:** WO-45 - Build minimal trace and evaluation sink for turns and guardrail violations
**Blueprints:** AI Evaluation & Observability, AI Guardrails

## Problem

WO-43 is told to "emit violations to the sink". There is no sink. This builds
the destination: a place a turn's spans and a guard's refusals land, and can be
looked at afterwards.

Deliberately not the eval suite. The blueprint's `EvalSuite` (tiered checks,
rubric scoring, drift alerting) is Phase 5 and is not started here.

## Approach

### Storage: two tables, migration 008

`traces` holds one row per turn with its spans as `jsonb`; `guardrail_violations`
holds one row per refusal. Separate tables because they are read for different
questions ("what did this turn cost and how long did it take" against "what did
the guards stop this week"), and because a violation outlives the turn it came
from as a case for WO-47 to replay.

Both cascade on `accounts.id`, so deleting an account takes its traces with it.

Retention: a trace is diagnostic data, not user data the product promises to
keep. `recordTrace` prunes that account's rows older than 14 days, so the table
is bounded without a scheduled job (Durable Workflows is Phase 5).

### `lib/trace/types.ts`

- `TraceSpan` - OpenTelemetry-shaped: id, name, kind (`model` | `tool` |
  `retrieval` | `guardrail`), start, end, duration, status, attributes.
- `AgentTrace` - id, account, start/end, spans, model, cost, and `outcome`.
- `TurnOutcome` - `pending` | `applied` | `undone`. This is ADR-002's
  acceptance signal in its smallest honest form.
- `GuardrailViolation` - guard, rule, severity (`block` | `revise` | `flag`),
  detail, and the offending sample.

### `lib/trace/collector.ts`

A pure builder. `newCollector({ traceId, accountId, now })` gives `span()`,
`measure()` (times a promise and records the span either way), `violation()`
and `finish()`. `now` is injected so the tests are not timing-dependent.

### `lib/trace/current.ts`

An `AsyncLocalStorage` holding the collector for the current server-side
operation. `withTrace(collector, fn)` binds it; `currentCollector()` reads it.
This is how a model call deep inside the gateway attaches its span to the turn
that caused it without every function signature growing a parameter.

### Gateway tracing middleware

`lib/ai/gateway.ts` gains a second middleware, wrapped outside the fallback one,
that records a `model` span per call: model id, input/output tokens, latency,
and cost computed from the registry's price. When no collector is bound the span
is dropped rather than buffered, because an unattributed span answers no
question worth the storage.

### The turn trace

The Coach turn runs inside eve, so the browser is what knows a turn happened.
`components/coach/thread.tsx` opens a trace when a turn starts, adds a `tool`
span for each `apply_action` envelope it applies, and posts the finished trace.
`lib/actions/store.tsx` reports `undone` when the user clicks undo on a Coach
change, via a new optional `traceId` on the dispatch options.

### `app/api/trace/route.ts`

- `POST` - accept a finished trace, or an outcome update for one.
- `GET` - the signed-in account's recent traces and violations.

Scoped to the caller's own account, which is the same rule every other endpoint
here follows. A cross-account operator view needs an admin role that does not
exist and is not in this work order.

### `app/dev/traces/page.tsx`

Renders what `GET /api/trace` returns. Development only, matching
`app/dev/chat`: English, no i18n, `notFound()` in production. The API is the
production inspection path.

## Testing

- The collector: spans get durations, a failing `measure` still records a span
  and rethrows, `finish` closes the trace, and the injected clock is respected.
- Violations: severity and rule survive the round trip.
- The store: a trace written and read back is the same trace, retention prunes
  only rows past the window and only for that account, and outcome updates
  land. Against a real migrated schema, like the other db tests.
- The API's shape validation: a body that is not a trace is refused rather than
  stored.

## Risks

- **A trace write must never break a turn.** Every emit path is fire and forget
  and swallows its own errors. A sink that can take the Coach down is worse
  than no sink.
- **Span volume.** One trace per turn, spans bounded by the steps in a turn. No
  per-token spans.
