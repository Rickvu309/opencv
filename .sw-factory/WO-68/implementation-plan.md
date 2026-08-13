# Implementation Plan: WO-68

**Work Order:** WO-68 - Polish landing and onboarding: visual craft and motion

## What this pass changed

The two surfaces a visitor meets before they have any reason to be patient.

- **The hero settles rather than snaps**, on the reveal duration, which is the
  longest on the scale and the right one for the first thing anybody sees.
- **The tour cards animate as themselves**, keyed on the step, rather than the
  text swapping inside a static box. The step counter and the changed words
  carry it under reduced motion.
- **Tabular numerals** on the step counter and the how-it-works numbers.

Both are inside `motion-safe:`, so the whole thing degrades to a static page
rather than to a broken one.
