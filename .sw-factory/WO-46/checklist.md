<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-46

**Work Order Number:** WO-46
**Work Order Title:** Build output grounding guard against profile facts
**Initialized At (UTC):** 2026-08-13T20:53:17Z

## Phase 1: Start / Context Gathering

### Required Steps

- [x] Review work order description provided by MCP tool output
- [x] Identify linked requirements and blueprints
      REQ-TRUST-001, carried in full in the work order. Blueprints: AI Guardrails, Trustworthy Coach.
- [x] Review every connected requirements document
      Read via the work order, which quotes each criterion in full.
- [x] Review every connected blueprint document
      AI Guardrails in full. Trustworthy Coach is an unfilled template in the factory (headings only); reported as a finding rather than treated as content.
- [x] Follow `@…` mentions **and links** to other blueprints in linked documents and read each referenced blueprint via MCP
      Followed @Action Registry & Store, @AI Evaluation & Observability, @Model Gateway & Routing and @Feature Flags & Experiments.
- [x] Review every referenced blueprint discovered that way; add them to **Referenced Blueprints** in `context.md`
- [x] Extract acceptance criteria from requirements
      Three criteria, each mapped to an implementation and a test in review-log.md.
- [x] Identify architecture path from blueprints (components, contracts, composition)
      The OutputGuard grounding check of ADR-002, grounding against profile facts in AppState. Market grounding deliberately absent.
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
      Grounding only. No market-source grounding, no change to the WO-43 guards or the WO-45 sink.
- [x] Tests added or updated for changed behavior
      13 added, including six negative cases.
- [x] Documentation, generated files, fixtures, migrations, or config updated where relevant
      One i18n entry, guardrails.notGrounded. No migration.

- [x] **Certification: Phase 2 complete. Proceeding to Phase 3.**

## Phase 3: Review And Verification

### Review

- [SKIP] Review subagent spawned per `execution/review-phase.md` and returned a verdict
      Skip reason: this agent operates under a standing instruction not to spawn
      subagents unless the user asks. The review was run inline over the same
      dimensions and is recorded in `review-log.md`.
- [x] All acceptance criteria from the Work Order and linked requirements are satisfied
      Three of three; see the table in review-log.md.
- [x] Architecture is aligned with linked blueprints, or documented drift is accepted
      One documented deviation: revise rather than block, for the same streaming reason as WO-43.
- [x] Exploratory pass on user-visible or external behavior — not only automated tests; for browser apps, use browser-based testing if available. Brief notes in `review-log.md` or evidence.
      Not exercised against a live model turn: no provider key locally. The check is pure, so the tests are the substance; the wiring is covered by the deploy verification. Limit recorded.
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
