# Implementation Plan: WO-29

**Work Order:** WO-29 — Add cover letter as a built document with Coach drafting

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Add cover letter as a built document with Coach drafting

## Files

- `agent/instructions.md`
- `agent/instructions.test.ts`

## Approach and decisions

- The actions landed in WO-35; this work order is the half that decides whether they are used well.
- The Coach already sees `papers`: `lib/actions/context.ts` sends the whole `AppState` on the turn.

## Acceptance criteria and how each is met

- **AC-PAPERS-006.1 (WO calls it 004.1)** — instructions tell the Coach to draft from the profile and the role (`agent/instructions.test.ts`)
- **AC-PAPERS-006.2** — every paragraph is editable; see WO-31 (`lib/papers/papers.test.ts`)
- **AC-PAPERS-006.3** — the ask-rather-than-invent rule is written down and tested for (`agent/instructions.test.ts`)

## Testing

7 instruction tests pass, including the no-inventing rules.

## Scope notes

Numbering drift: the work order cites REQ-PAPERS-004, the requirements document numbers the same criteria REQ-PAPERS-006. Both are covered.
