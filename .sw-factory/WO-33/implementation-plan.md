# Implementation Plan: WO-33

**Work Order:** WO-33 — Add Coach drafting and refining for pitch items

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Add Coach drafting and refining for pitch items

## Files

- `agent/instructions.md`
- `agent/instructions.test.ts`

## Approach and decisions

- Undo is the store's existing toast action; a Coach dispatch is not silent, so every Coach edit offers it.

## Acceptance criteria and how each is met

- **AC-PITCH-001.1** — bio drafted from the profile (`agent/instructions.test.ts`)
- **AC-PITCH-002.1** — introduction drafted from profile and goal (`agent/instructions.test.ts`)
- **AC-PITCH-002.3** — the Coach asks for the goal first when it is unset (`agent/instructions.test.ts`)
- **AC-PITCH-003.1** — answers grounded in the profile (`agent/instructions.md`)
- **AC-PITCH-003.3 / 005.x** — never invent an experience; refine on request; undo from the store's toast (`agent/instructions.test.ts`)

## Testing

Instruction tests assert each rule a requirement turns on.

## Scope notes

Numbering drift: the work order cites REQ-PITCH-004 for refinement; the requirements document numbers it REQ-PITCH-005.
