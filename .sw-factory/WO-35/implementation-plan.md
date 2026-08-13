# Implementation Plan: WO-35

**Work Order:** WO-35 — Add ProseDocument model and export for built prose documents

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Add ProseDocument model and export for built prose documents

## Files

- `lib/papers/types.ts`
- `lib/papers/export.ts`
- `lib/actions/registry.ts`
- `lib/db/migrations/005_papers_in_state.*.sql`
- `lib/state/account-state.ts`
- `lib/actions/persistence.ts`

## Approach and decisions

- Paragraphs derived from one body string rather than stored as an array, so a textarea's trailing newline cannot become an empty paragraph.
- Seven granular actions; `paper.setBody` exists for a first draft and its own description steers the model to `updateParagraph` for edits.
- Both `.remove*` actions ask first, which is the rule every removal in the registry follows.
- No JSON export: a prose document's JSON is its plain text with punctuation around it.

## Acceptance criteria and how each is met

- **(foundation)** — behaviour is verified through WO-29 and WO-30 (`lib/papers/papers.test.ts`)

## Testing

18 papers tests pass.

## Scope notes

Also closed a data-loss hazard left by WO-24: a row whose shape had moved on was refused, the page rendered the seed, and the next click saved that seed over the user's real work. An older row is now filled in from the seed and kept.
