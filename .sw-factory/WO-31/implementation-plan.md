# Implementation Plan: WO-31

**Work Order:** WO-31 — Build document workspace UI for cover letter and project write-up

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Build document workspace UI for cover letter and project write-up

## Files

- `app/(app)/papers/page.tsx`
- `components/papers/paragraph-editor.tsx`
- `components/papers/paper-print.tsx`

## Approach and decisions

- One box per paragraph, not one for the whole body: the Coach edits by paragraph, and a single box has to write the whole body back, so a draft landing mid-sentence would be overwritten by the next blur.
- Export reuses `lib/papers/export.ts`; PDF is the browser's print through a body-mounted portal, as the CV does.
- Deliberately does not reuse the resume section/header editors or the A4 preview, per the work order's exclusion.

## Acceptance criteria and how each is met

- **AC-PAPERS-006.2** — every paragraph is its own editable box (`app/(app)/papers/page.tsx`)
- **AC-PAPERS-007.2** — same surface serves write-ups (`app/(app)/papers/page.tsx`)

## Testing

Both screens render signed in and 307 signed out. A print-portal defect found in review was fixed (see review-log).

## Scope notes

An 'ask the Coach' button was added so the request does not have to be retyped in the chat.
