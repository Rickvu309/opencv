# Review Log: WO-45

**Work Order:** WO-45 - Build minimal trace and evaluation sink for turns and guardrail violations
**Date:** 2026-08-13

## Review method

Inline, over the dimensions in `execution/review-phase.md`. A review subagent
was not spawned: this agent operates under a standing instruction not to spawn
subagents unless the user asks.

## Scope

In Scope, item by item:

| Asked for | Built |
|---|---|
| `TraceCollector` emitting a span per turn step | `lib/trace/collector.ts`, spans of kind model / tool / retrieval / guardrail |
| Enriched with model id, tokens, cost, latency, guardrail outcome | The gateway's tracing middleware supplies model id, tokens and cost; the collector times everything; a violation is also a span |
| Receive and store guardrail violations | `recordViolation`, `guardrail_violations` table. WO-43 emits through `Collector.violation` |
| Record accept/undo as a quality signal | `TurnOutcome`, written when the turn ends and updated from the undo button in `store.tsx` |
| A basic way to inspect | `GET /api/trace` in any environment, `/dev/traces` in development |

Out of Scope, confirmed absent: no `EvalSuite`, no rubric, no scoring, no drift
alerting, no routing or flag decisions fed from anything here. The gateway and
the guards are unchanged in behaviour; the middleware only observes.

## Blueprint alignment

- **Trace everything.** Every model call the gateway makes emits a span when a
  trace is bound. A turn's spans and its latency come from the browser, which
  is the only participant that sees a whole turn.
- **ADR-002, user acceptance is a primary quality signal.** Implemented as the
  `outcome` column, tied to the store's existing undo, exactly as the ADR says
  ("It requires tying trace records to the store's undo events").

### Documented limit

**Model spans are not joined to Coach turn traces.** The Coach turn runs inside
eve, which owns its own model call, and the trace id is not threaded through
eve's stream. So a Coach turn's trace carries its latency and its tool calls but
not its token counts, while the gateway's model spans attach to server-side
traces (the guardrail checks in WO-43 and WO-46, and the conformance run in
WO-47). Joining them needs a turn id carried through the agent, which is not in
this work order. Stated here rather than papered over.

## Correctness

- **The sink cannot take a turn down.** `lib/trace/client.ts` swallows its own
  errors and uses `keepalive`. The API's failure path logs and returns 502
  without touching the caller's flow.
- **A browser cannot write another account's row.** The account is taken from
  the session and overwritten onto whatever the body claimed; `markOutcome`
  has the account in its `where` clause. Both are tested.
- **Cost does not round to nothing.** `numeric(12,6)`, read back through
  `Number()` on the string Postgres returns rather than a float column. Tested
  against a real schema at $0.000123.
- **Retention is bounded without a scheduler.** `recordTrace` prunes that
  account's aged rows. A test proved a first draft of this wrong: writing an
  already-stale trace deletes it by its own write. That is correct behaviour,
  and the test was rewritten to age rows in SQL so it tests the sweep rather
  than the writer.

## Verification

- `npx tsc --noEmit` clean. `npm run lint` clean.
- `npm run build` compiles; `/api/trace` and `/dev/traces` are in the route list.
- Migration 008 applied to the Railway database; `db:status` shows it applied.
- `lib/trace/*` tests: 23 pass, 0 fail, against a real migrated schema.
- Full suite: see below.

### Exploratory pass

Against `next dev` with a real account created through the sign-up endpoint:

| Check | Result |
|---|---|
| POST a finished trace | 200, stored |
| POST an outcome update | 200, row moved to `undone` |
| GET it back | the trace, with the account id from the session rather than from the body |
| POST a body that is not a trace | 400 `bad-trace`, nothing stored |
| GET with no session | 401 `no-session` |
| `/dev/traces` | renders the turn, its model, its `undone` badge and its `apply_action:todo.add` span |

The test account was deleted afterwards.

## Verdict

**APPROVED**
