# Implementation Plan: WO-30

**Work Order:** WO-30 — Add project write-up as a built document with Coach drafting

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Add project write-up as a built document with Coach drafting

## Files

- `agent/instructions.md`
- `agent/instructions.test.ts`

## Approach and decisions

- `project-write-up` is a kind on the same `ProseDocument`, not a second model.

## Acceptance criteria and how each is met

- **AC-PAPERS-007.1** — the three-part story rule is in the instructions (`agent/instructions.test.ts`)
- **AC-PAPERS-007.2** — editable through the same paragraph actions (`lib/papers/papers.test.ts`)
- **AC-PAPERS-007.3** — 'không bịa con số' is written down and tested for (`agent/instructions.test.ts`)

## Testing

Covered by the instruction tests.

## Scope notes

Same numbering drift as WO-29 (work order says 005, requirements say 007).
