## Move the Apply board onto Kibo kanban (DS-3)

**Depends on.** DS-1.

**Files.**

- [ ] Add `pnpm dlx shadcn@latest add https://www.kibo-ui.com/r/kanban.json https://www.kibo-ui.com/r/status.json -c apps/web`. This also adds stock `scroll-area` (kanban's `registryDependencies`, A6) and the packages `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `tunnel-rat`. Run `node scripts/ds-codemod.mjs` after.
- [ ] Edit `apps/web/src/features/apply/apply-workspace.tsx` (383 lines), `apply-board-card.tsx`.
- [ ] Delete `apps/web/src/features/apply/apply-dnd.ts` once no caller remains.
- [ ] Edit Apply tests that drive native `dragstart` and `drop`.
- [ ] Edit `design-vocabulary.test.ts` (drop Apply rows from the legacy allowlist, if any).

**Build.**

- [ ] Data shape. The board is `KanbanProvider` over `columns` (the five stages, Inbox, Prep, Sent, Live, Closed) and `data` (cards with `id`, `name`, `column`). `onDataChange` calls the existing stage-move mutation in `use-apply-cards.ts`. Nothing else in the domain changes.
- [ ] Cards render through `KanbanCard` with the existing card body. Title wraps to two lines, company on one (research Apply 4, verify-app-ui 36).
- [ ] Column headers use Kibo `Status` (badge-based, `registryDependencies":["badge"]`, A6) with the chart-token dot beside the stage word (verify-app-ui 23).
- [ ] Keyboard and screen reader. Kanban wires `KeyboardSensor` and dnd-kit `Announcements` (both imported in `kanban.json`, A6). Write the announcement strings in OpenCV nouns ("Moved Opportunity to Sent").
- [ ] Click still opens the detail. Set a pointer activation distance so a click is not a drag.
- [ ] Scan pasted files for `asChild` and convert to `render`. Confirm the Kibo files import `cn` from the repo alias after install.
- [ ] Do not add Kibo `table` or `calendar` (Appendix B4).

**You see.**

- [ ] Dragging a card from Inbox to Sent moves it and it is still in Sent after reload.
- [ ] Space on a focused card picks it up, arrows move it, Space drops it, and the move persists.
- [ ] The five headers show dot plus word, no horizontal scroll at 1440 or 390.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] A board test moves a card with the keyboard sensor through `@testing-library/user-event` and asserts the mutation call and the new column by role. Red at trunk (native drag has no keyboard path), green at head.
- [ ] `apply-search.test.ts`, `apply-types.test.ts` unchanged and green.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Mouse-drag one card Inbox to Sent at trunk and head, reload. Save `ds3-regression.png`. Pass when both persist.
- [ ] Lane 2. Keyboard move at head (trunk has none, so the lane records that and gates head only). Save `ds3-keyboard.png`. Pass when the move persists after reload.
- [ ] Lane 3. Screen reader text. Snapshot the live region during a keyboard move. Save `ds3-announce.png`. Pass when it names the card and the target stage.
- [ ] Lane 4. verify-app-ui 16 at 1440 and 390. Save `ds3-stages.png`. Pass when it passes.
- [ ] Lane 5. verify-app-ui 10 (empty board, one empty state). Save `ds3-empty.png`. Pass when it passes.
- [ ] Lane 6. verify-app-ui 36 and 23 and 22. Save `ds3-density.png`. Pass when all pass.
- [ ] Lane 7. Touch drag at 390x844 with touch emulation. Save `ds3-touch.png`. Pass when the move persists and the page does not scroll sideways (verify-app-ui 38).
- [ ] Lane 8. Click a card. Save `ds3-detail.png`. Pass when the detail opens and no drag starts.
- [ ] Lane 9. verify-app-ui 24, 25, 20, 21 on Apply. Save `ds3-motion-a11y.png`. Pass when all pass.
- [ ] Lane 10. Gates. `scripts/review-pr.sh <pr#>`. Save `ds3-gates.png`. Pass when it prints `OK`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Metric A on the entry chunk and the Apply route chunk. Metric B on Apply.
- [ ] Probe. Three builds and three checker runs per side, interleaved trunk then head, in two worktrees, per the perf method.
- [ ] Baseline. Trunk medians first.
- [ ] Rule. Apply chunk at most +25 KB gzip over trunk, entry at most +1 KB, Apply under 2000 ms. The 25 KB is a budget for dnd-kit plus tunnel-rat, not a measurement. A larger number fails.

**Risks.** dnd-kit's sortable reorders within a column, which the domain may not store. If card order is not persisted, the owner disables in-column reorder rather than adding a field. Drag overlay z-order against the detail panel (lane 8).

**Review gate.** The operator reviews before merge.

- [ ] Save lanes 1, 2 and 7 screenshots and a 30 to 60 second video of mouse, keyboard and touch moves as `/home/quan/tmp/opencv-review/DS-3-review.mp4`. Post them in chat for the operator. Stop at merge-ready.

**Merge.**

- [ ] `review-pr.sh` OK, gates green at the exact head, independent review clean, then `gh pr merge <pr#> --squash --admin` and cleanup.
