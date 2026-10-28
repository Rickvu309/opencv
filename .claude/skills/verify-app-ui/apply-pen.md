# Apply against opencv.pen

`PORT=4454 heavy -- pnpm --filter web verify:apply-pen` runs `scripts/verify-apply-pen.mjs`. It signs up Linh Nguyen on its own stack, saves the jobs the W9 and W10 frames draw, fixes the page clock at Sunday 25 October 2026 09:00 in Asia/Ho_Chi_Minh, and opens each state (board, list, filters, month, week, New job and its three states, job detail, Paper picker, closed job, delete). For each state it compares every pen text's colour, size, weight, line height and tracking, and every drawn icon's size, with `apps/web/src/features/apply/design/<slug>.styles.json`, then runs pen-layout's `comparePenLayout` against `<slug>.layout.json` (text boxes within 8px, the lightest-AA colour rule). `VERIFY_APPLY_PEN_ALL=1` prints every mismatch. Known gaps live in `scripts/lib/apply-pen-gaps.mjs`. A text the live stack cannot draw (server dates, data the product does not store) sits in `NOT_SHOWN` with its reason. `VERIFY_APP_UI_SHOTS=<dir>` saves one screenshot per state. W9.6 (mid-drag) is checked by `apply-design-parity.test.tsx`, which also checks every frame's texts and icon count with fixed data.

Regenerate a frame's files when the pen changes:

```
node scripts/pen-snapshot.mjs <pen> <frame id> apps/web/src/features/apply/design/<slug>.snapshot.json --root <GIhbq or the dialog node id> --styles
node scripts/pen-layout.mjs <pen> <frame id> apps/web/src/features/apply/design/<slug>.layout.json --route <route> --pane <same id> --driver verify-apply-pen
```

`--driver` makes `verify:pen-layout` skip the layout, since only this script can seed the data and open the dialog. Pen greys that fail AA ship as the lightest AA grey on their surface (`apps/web/src/features/apply/apply-tone.ts`). Positions the product cannot match (a chip for data it does not store) sit in `LAYOUT_EXCEPTIONS` in `scripts/lib/apply-pen-gaps.mjs`, dated and pending the operator.
