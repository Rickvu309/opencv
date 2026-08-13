# Implementation Plan: WO-47

**Work Order:** WO-47 - Verify guardrails with an adversarial conformance test set
**Requirements:** REQ-TRUST-001 to REQ-TRUST-004
**Blueprints:** AI Guardrails, AI Evaluation & Observability, Trustworthy Coach

## Problem

WO-43 and WO-46 built the guards. Their tests were written beside the code, by
whoever wrote the code, and they check that each rule does what its author
meant. That is necessary and it is not the same claim as "the guards hold".

This set is written from the acceptance criteria instead, by somebody trying to
get through.

## Approach

### `lib/guardrails/conformance.ts` - the cases as data

One case per acceptance criterion, phrased adversarially, plus an **innocent
twin** for each. The twins are the load-bearing half: a guard that refuses
everything passes every hostile case and is useless, and only the twins tell a
guard from a wall.

Data rather than assertions, so the same set can run three ways: as a test, as
a recorded conformance run, and later as the seed of the Phase 5 eval suite.

Each case carries the criterion it proves and a note saying why it is there, so
the next person can tell a deliberate edge from a typo.

### `lib/guardrails/conformance.run.ts` - running it

`runCase` puts a case through the right guard and reports the outcome in the
set's own vocabulary (refused / redirected / revised / allowed) rather than in
each guard's internal verdict type, so a guard can be rewritten without
rewriting the set.

`runConformance` runs everything and, when given a collector, records each
failure as a violation. The blueprint asks for the guards' own accuracy to be
measured rather than assumed, and a pass rate nobody stores is not a
measurement.

## Testing

The set itself, plus four properties of the set:

- every criterion has a case, checked against an explicit list so a criterion
  added later fails until somebody writes its case
- the set has enough innocent cases to catch a wall and enough hostile ones to
  catch a sieve
- **turning the guards off fails the set.** This is the proof the set has
  teeth; without it a set that asserts nothing would pass forever
- failures are recorded as violations rather than only counted

## Out of scope

The guards (WO-43, WO-46) and the sink (WO-45) are not changed. The tiered eval
suite and drift alerting are Phase 5; this is a focused conformance set.
