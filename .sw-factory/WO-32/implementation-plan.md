# Implementation Plan: WO-32

**Work Order:** WO-32 — Add PitchItem model and pitch actions to the registry

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Add PitchItem model and pitch actions to the registry

## Files

- `lib/pitch/types.ts`
- `lib/actions/registry.ts`
- `lib/actions/types.ts`
- `lib/actions/seed.ts`
- `lib/db/migrations/006_pitch_in_state.*.sql`

## Approach and decisions

- One bio and one self-introduction, many answers, enforced in the reducer rather than on the screen, so the Coach cannot make a second bio by asking.
- Rewriting a singleton keeps its id, or every screen watching it loses its place mid-edit.
- Each item carries its own language.

## Acceptance criteria and how each is met

- **AC-PITCH-001.2** — bio editable and saved (`lib/pitch/pitch.test.ts`)
- **AC-PITCH-001.3** — bio text separate from the profile link (`lib/pitch/pitch.test.ts`)
- **AC-PITCH-002.2** — self-introduction editable and saved (`lib/pitch/pitch.test.ts`)
- **AC-PITCH-003.2** — answers saved and edited later (`lib/pitch/pitch.test.ts`)
- **AC-PITCH-004.1/004.2 (WO cites 003.3)** — many answers kept, one removable (`lib/pitch/pitch.test.ts`)

## Testing

10 pitch tests pass.

## Scope notes

None. The change stays inside the work order's In Scope list.
