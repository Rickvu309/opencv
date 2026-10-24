## Move the Paper editor onto stock pieces (DS-4a)

**Depends on.** DS-2 (the Confirmation pattern) and #308 merged.

**Files.**

- [ ] Add `pnpm dlx shadcn@latest add table -c apps/web`. Add `resizable` only if the side-pane box below fires. Run `node scripts/ds-codemod.mjs` after.
- [ ] Edit the Paper document list (raw `<table>` at `paper-workspace.tsx:396` on main, wherever #308 moved it, likely `paper-drive.tsx`).
- [ ] Edit `paper-suggestion-bar.tsx` (added by #308), `paper-letter-article.tsx`, `coach-float.tsx`.
- [ ] Edit `apps/web/src/styles/paper.css` (drop `.prose-kit`, `.paper-coach-changed` when no importer remains).
- [ ] Delete the `.coach-float-*` rules left in `coach.css` if the pane moves in-flow.
- [ ] Edit `design-vocabulary.test.ts` (drop Paper rows from the legacy allowlist).

**Build.**

- [ ] The document list renders with stock `Table`, `TableHeader`, `TableRow`, `TableCell`. While the call is held it shows "Loading documents" and skeleton rows in the table's width, never the table (verify-app-ui 11, 29). Keep #308's `paper-row-menu.tsx` as the row action.
- [ ] The suggestion bar renders as the Confirmation pattern (an `Item` with two buttons, A3) over #308's `paper-suggestion.ts` and `use-suggestion-marks.ts`. Keep #308's button labels so verify-app-ui 30 keeps passing.
- [ ] Side pane. Run verify-app-ui 15 at trunk first. If it passes, #308 already docked the Coach, and this PR only deletes the unused `.coach-float-*` CSS. If it fails, put the Coach in an in-flow right pane on stock `ResizablePanelGroup`, full height, with the CV as the widest panel.
- [ ] Letter prose uses stock utilities in place of `.prose-kit`.
- [ ] No Cult UI, Magic UI or affectUI piece. Research section 4 names no showpiece on Paper and says "The work is the showpiece" (`~/tmp/opencv-run/APPUI/research.md`, section 4 preamble).

**You see.**

- [ ] The Paper list is a stock table with 40 to 72 px rows. Holding the api shows skeleton rows and the loading sentence.
- [ ] A Coach suggestion shows one Item with its two buttons, and pressing the reject button restores the text.
- [ ] With the Coach open at 1440x900, no CV text sits under it.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `paper.craft.test.tsx` (from #308) stays green. A new list test asserts the loading sentence and no `table` role while the request is pending. Red at trunk if trunk mounts the table early, green at head.
- [ ] `paper-suggestion.test.ts` unchanged and green.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open a CV, type, Undo, at trunk and head. Save `ds4a-regression.png`. Pass when both behave the same.
- [ ] Lane 2. verify-app-ui 11 and 29. Save `ds4a-loading.png`. Pass when both pass.
- [ ] Lane 3. verify-app-ui 15 at 1440. Save `ds4a-pane.png`. Pass when it passes.
- [ ] Lane 4. verify-app-ui 30 and 08. Save `ds4a-suggest.png`. Pass when 30 passes and 08's result is recorded (08 reads Coach features source).
- [ ] Lane 5. verify-app-ui 18, 06, 01. Save `ds4a-writing.png`. Pass when all pass.
- [ ] Lane 6. verify-app-ui 36 Paper rows and 31. Save `ds4a-rows.png`. Pass when both pass.
- [ ] Lane 7. Print. Open the CV print preview with `agent-browser` PDF output. Save `ds4a-print.png`. Pass when the A4 page matches trunk (CV print paper is unchanged by design).
- [ ] Lane 8. Keyboard through the list, the row menu and the suggestion buttons. Save `ds4a-keyboard.png`. Pass when every action works with no pointer (verify-app-ui 32).
- [ ] Lane 9. verify-app-ui 24, 25, 20, 21, 38 on Paper. Save `ds4a-motion-a11y.png`. Pass when all pass.
- [ ] Lane 10. Gates. `scripts/review-pr.sh <pr#>`. Save `ds4a-gates.png`. Pass when it prints `OK`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Metric A on the Paper route chunk, Metric B on Paper and the open CV.
- [ ] Probe. Three builds and three checker runs per side, interleaved trunk then head, in two worktrees, per the perf method.
- [ ] Baseline. Trunk medians first.
- [ ] Rule. Paper chunk at most +4 KB gzip (`table`, and `resizable` if added), both routes under 2000 ms. A larger number fails.

**Risks.** #308 is a large refactor (`paper-workspace.tsx` minus 425 lines), so file paths in this section are from main and the owner re-reads them after #308 merges. The editor caret and selection model is not touched here.

**Review gate.** The operator reviews before merge.

- [ ] Save lanes 2, 3 and 4 screenshots and a 30 to 60 second video of loading, a suggestion accepted and one rejected as `/home/quan/tmp/opencv-review/DS-4a-review.mp4`. Post them in chat for the operator. Stop at merge-ready.

**Merge.**

- [ ] `review-pr.sh` OK, gates green at the exact head, independent review clean, then `gh pr merge <pr#> --squash --admin` and cleanup.
