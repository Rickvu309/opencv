# Implementation Plan: WO-36

**Work Order:** WO-36 — Relabel CV templates by purpose (local vs international)

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Relabel CV templates by purpose (local vs international)

## Files

- `lib/i18n/messages.ts`
- `lib/cv/types.ts`
- `app/(app)/cv/page.tsx`

## Approach and decisions

- Display strings only. The identifiers in the model are untouched; renaming them would migrate every stored CV to buy a tidier word in the source.

## Acceptance criteria and how each is met

- **AC-PAPERS-010.1** — no template is named by a style word (`lib/cv/resume.test.ts`)
- **AC-PAPERS-010.2** — a new CV gets the default template (`lib/cv/resume.test.ts`)
- **AC-PAPERS-010.3** — changing template leaves content byte-identical (`lib/cv/resume.test.ts`)

## Testing

3 template tests pass.

## Scope notes

None. The change stays inside the work order's In Scope list.
