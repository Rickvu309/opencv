# Implementation Plan: WO-67

**Work Order:** WO-67 - Motion and transitions pass

## What this pass changed

- **`transition-all` is gone.** One instance, on the sidebar drag rail, where
  only the border colour actually moves.
- **Off-token easings are gone.** `ease-linear` and `ease-in-out` shipped in
  the vendored shadcn primitives (sidebar, sheet); both now use
  `--ease-enter`/`--ease-snap` and the duration scale. Verified by grep: zero
  remaining.
- **Reduced-motion branches added** to those same primitives, which had none.
- **Motion where a state change read as a jump**: the saved-opening toggle and
  the application status buttons (press-scale duration, snap curve), the
  opening detail expanding, the checklist ticking.
- **Named easing on the flash rows**, which had a duration token and no curve.

## The rule that shaped all of it

Motion never carries the meaning alone. The saved bookmark fills in and changes
colour; the status button changes variant; the checklist strikes through and
swaps its icon. Turn motion off and every one of those still reads.
