# Implementation Plan: WO-49

**Work Order:** WO-49 - Build per-application document tailoring

## Approach

Two actions, `application.tailorResume` and `application.tailorLetter`. Neither
reimplements copying: they call `resume.duplicate` and `paper.create` through
`applyAction` and bind the id of what came back.

That matters more than it looks. `resume.duplicate` rewrites section and entry
ids so two CVs cannot share one; a hand-rolled copy here would have missed that
and every later edit would have landed on both documents at once.

## Decisions worth stating

- **The original is never touched.** AC-APP-003.2 and AC-APP-004.2 say so, and
  a test proves it by renaming the copy and checking the original's label.
- **Deleting an application keeps its tailored documents.** The copy is an
  evening of the user's work. Deleting the tracking row is a decision about the
  row.
- Editing and undo come free: a tailored document is an ordinary `Resume` or
  `ProseDocument`, so every existing edit action and the store's undo already
  apply to it (AC-APP-003.3, AC-APP-004.3).
