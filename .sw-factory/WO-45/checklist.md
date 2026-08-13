<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-45

**Work Order Number:** WO-45
**Work Order Title:** Build minimal trace and evaluation sink for turns and guardrail violations
**Initialized At (UTC):** 2026-08-13T20:22:54Z

## Phase 1: Start / Context Gathering

### Required Steps

- [x] Review work order description provided by MCP tool output
- [x] Identify linked requirements and blueprints
      Two blueprints, no requirements document; the work order states it traces to blueprint contracts rather than user-facing acceptance criteria.
- [SKIP] Review every connected requirements document
      Skip reason: this work order has no linked requirements document. It is
      infrastructure and traces to the AI Evaluation & Observability contracts.
- [x] Review every connected blueprint document
      AI Evaluation & Observability, AI Guardrails.
- [x] Follow `@…` mentions **and links** to other blueprints in linked documents and read each referenced blueprint via MCP
      Followed @Model Gateway & Routing, @Feature Flags & Experiments, @Action Registry & Store, @Coach Knowledge & Memory (RAG) and @Durable Workflows. The last three are Phase 4/5 and out of scope here.
- [x] Review every referenced blueprint discovered that way; add them to **Referenced Blueprints** in `context.md`
- [SKIP] Extract acceptance criteria from requirements
      Skip reason: no linked requirements document, as above.
- [x] Identify architecture path from blueprints (components, contracts, composition)
      TraceCollector maps to lib/trace/collector.ts; AgentTrace to lib/trace/types.ts and migration 008. EvalSuite deliberately not built.
- [x] `context.md` is filled or updated with `execution/scripts/update-context-index.sh` for Work Order, connected requirements, connected blueprints, referenced blueprints, and known delivery links
      Written by the script.

- [x] **Certification: Phase 1 complete. Proceeding to Phase 2.**

## Phase 2: Planning And Implementation

### Implementation Plan

(see `execution/writing-implementation-plans.md`)

- [x] Implementation plan documented in `implementation-plan.md`
      Written before any implementation file was touched.
- [x] Testing section documented in `implementation-plan.md`

### Implementation

- [x] Implemented changes are scoped to the Work Order
      No eval suite, no rubric, no drift alerting. The gateway's behaviour is unchanged; the new middleware only observes.
- [x] Tests added or updated for changed behavior
      23 added across collector, types and store.
- [x] Documentation, generated files, fixtures, migrations, or config updated where relevant
      Migration 008 written and applied to the Railway database.

- [x] **Certification: Phase 2 complete. Proceeding to Phase 3.**

## Phase 3: Review And Verification

### Review

- [SKIP] Review subagent spawned per `execution/review-phase.md` and returned a verdict
      Skip reason: this agent operates under a standing instruction not to spawn
      subagents unless the user asks. The review was run inline over the same
      dimensions and is recorded in `review-log.md`.
- [x] All acceptance criteria from the Work Order and linked requirements are satisfied
      In Scope satisfied item by item; see the table in review-log.md.
- [x] Architecture is aligned with linked blueprints, or documented drift is accepted
      One documented limit: model spans are not joined to Coach turn traces. See review-log.md.
- [x] Exploratory pass on user-visible or external behavior — not only automated tests; for browser apps, use browser-based testing if available. Brief notes in `review-log.md` or evidence.
      Six checks against next dev with a real account, including the refusal paths. Recorded in review-log.md.
- [x] Latest `review-log.md` verdict is `APPROVED`

- [x] **Certification: Phase 3 complete. Proceeding to Final Completion.**

## Final Completion Check

- [x] All phase certifications above are complete
- [x] Checklist is fully filled out with evidence
- [x] Review log is complete (`review-log.md`)
- [x] Implementation plan was followed (`implementation-plan.md`)
- [x] All intended files are present in the working tree
- [x] Work order status updated to `in_review`
      Then to completed after the phase deploy verification.
