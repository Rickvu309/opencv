<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-58

**Work Order Number:** WO-58
**Work Order Title:** Retire Todo and Action Plan features (screens, actions, state)
**Initialized At (UTC):** 2026-08-13T21:00:56Z

## Phase 1: Start / Context Gathering

### Required Steps

- [x] Review work order description provided by MCP tool output
- [x] Identify linked requirements and blueprints
      No requirements document: both work orders remove undocumented features, which is the stated reason they exist.
- [SKIP] Review every connected requirements document
      Skip reason: no feature requirement covers the retired surface. The work
      order says so in its Requirements section.
- [x] Review every connected blueprint document
      Action Registry & Store.
- [x] Follow `@…` mentions **and links** to other blueprints in linked documents and read each referenced blueprint via MCP
      Followed and already read this session.
- [x] Review every referenced blueprint discovered that way; add them to **Referenced Blueprints** in `context.md`
- [SKIP] Extract acceptance criteria from requirements
      Skip reason: no linked requirements document, as above. The In Scope and
      Out of Scope lists are the definition of done.
- [x] Identify architecture path from blueprints (components, contracts, composition)
      The dispatch and persistence seam: actions come out of the registry, fields come out of AppState by migration rather than by wipe.
- [x] `context.md` is filled or updated with `execution/scripts/update-context-index.sh` for Work Order, connected requirements, connected blueprints, referenced blueprints, and known delivery links
      Written by the script.

- [x] **Certification: Phase 1 complete. Proceeding to Phase 2.**

## Phase 2: Planning And Implementation

### Implementation Plan

(see `execution/writing-implementation-plans.md`)

- [x] Implementation plan documented in `implementation-plan.md`
      Written before the removal began.
- [x] Testing section documented in `implementation-plan.md`

### Implementation

- [x] Implemented changes are scoped to the Work Order
      Nothing outside the In Scope list was removed.
- [x] Tests added or updated for changed behavior
      Tests that used the retired actions as a handle moved to surviving actions; tests of the retired behaviour were deleted with it.
- [x] Documentation, generated files, fixtures, migrations, or config updated where relevant
      Migration 009_drop_todos_and_plan written and applied to the Railway database.

- [x] **Certification: Phase 2 complete. Proceeding to Phase 3.**

## Phase 3: Review And Verification

### Review

- [SKIP] Review subagent spawned per `execution/review-phase.md` and returned a verdict
      Skip reason: this agent operates under a standing instruction not to spawn
      subagents unless the user asks. The review was run inline over the same
      dimensions and is recorded in `review-log.md`.
- [x] All acceptance criteria from the Work Order and linked requirements are satisfied
      In Scope satisfied item by item; Out of Scope respected.
- [x] Architecture is aligned with linked blueprints, or documented drift is accepted
      The field-drop follows the same dispatch and persistence seam.
- [x] Exploratory pass on user-visible or external behavior — not only automated tests; for browser apps, use browser-based testing if available. Brief notes in `review-log.md` or evidence.
      Live: /todo and /plan 404, the five surviving routes 200, the sidebar has no dead links.
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
