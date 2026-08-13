# Implementation Plan: WO-34

**Work Order:** WO-34 — Build My Pitch workspace UI (bio, self-intro, answer bank)

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Build My Pitch workspace UI (bio, self-intro, answer bank)

## Files

- `app/(app)/pitch/page.tsx`
- `components/app-sidebar.tsx`
- `lib/i18n/messages.ts`

## Approach and decisions

- Three surfaces on one screen: somebody preparing for an interview works on all three in one sitting.
- Every box takes what the store hands back, compared against the last value it was given, so a Coach draft lands without interrupting somebody mid-word.

## Acceptance criteria and how each is met

- **AC-PITCH-001.2** — bio editor dispatches pitch actions (`app/(app)/pitch/page.tsx`)
- **AC-PITCH-002.2** — introduction editor (`app/(app)/pitch/page.tsx`)
- **AC-PITCH-003.2** — answers saved and edited (`app/(app)/pitch/page.tsx`)
- **AC-PITCH-004.1/2/3** — many answers, removable, and removal offers undo because the dispatch is not silent (`app/(app)/pitch/page.tsx`)

## Testing

Screen renders in both languages, gated signed out.

## Scope notes

None. The change stays inside the work order's In Scope list.
