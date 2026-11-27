---
status: accepted
---

# CI is the review, and a green change merges itself

From 2026-11-13 no agent reviews a pull request: a change merges by itself once the required check is green on its head, and main deploys once its own full run is green (ADR 0003). We chose this because review by agents was slow and still leaky. Of 43 reviewer verdicts in the record, 26 found a blocking defect after the builder had said done, and one passing verdict let an imported-CV outage reach production. About 35 to 55 percent of the 74 defects in that record were within reach of a check the builder already had or a sweep that needs no insight, so the money goes into checks that run on every change rather than into a reader of each diff.

## Considered options

- Keep a reviewer agent on every pull request: rejected by the owner; one to six rounds per change, and a model reading a diff shares the builder's blind spots.
- Keep one short adversarial reviewer for risky changes only: rejected for the same reason; its questions moved to checks where a check can own them, and the rest are named residuals.
- Let CI be the review (chosen).

## Consequences

- Every PR, including changes to merge rules and high-risk files, merges automatically on green ci. A migration that does more than add still needs its allow-migration:<tag> label.
- Checks a builder did not write may grow but not weaken without a record; weakening one needs a recorded retirement in scripts/retired, and a replacement test with a flip proof makes it self-serve. Either way the change merges on green ci.
- Wrong prose in a pull request body, untrue product copy, and a builder misreading an ordinary issue are accepted as unowned residuals, each with a signal that would show it biting.
