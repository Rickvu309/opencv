## Move Pitch onto stock pieces and the Kibo contribution graph (DS-4b)

**Depends on.** DS-1 and #314 merged.

**Files.**

- [ ] Add `pnpm dlx shadcn@latest add alert -c apps/web` and `pnpm dlx shadcn@latest add https://www.kibo-ui.com/r/contribution-graph.json -c apps/web` (dependency `date-fns`, A6). Run `node scripts/ds-codemod.mjs` after.
- [ ] Edit `apps/web/src/features/pitch/pitch-types.ts:57-61`, `pitch-github-heatmap.tsx`, `pitch-workspace.tsx`, `pitch-showcase.tsx`, `pitch-edit-toolbar.tsx`.
- [ ] Edit `design-vocabulary.test.ts` (drop Pitch rows from the legacy allowlist).

**Build.**

- [ ] Tones. The `tone` union stays in the domain. Its class map points at stock surfaces only, `bg-muted` for warm, cool, neutral and emerald, `bg-primary text-primary-foreground` for dark. Remove the mint metric fill and the solid black tile used as decoration (research Pitch 7).
- [ ] Heatmap. `PitchGithubHeatmap` renders Kibo `ContributionGraph` from `pitch-github-mock.ts` data. Levels use `fill-muted` and `fill-primary` at 25, 50, 75 and 100 percent. Labels at `text-xs`. Kibo's styling hooks were not readable from the fetched JSON (A6 note), so the owner confirms the level selector on the docs page before styling.
- [ ] Status. "Published" is `Badge variant="secondary"` with a check icon. "Unpublished" is stock `Alert` with the sentence and the Publish button in the same row (research Pitch 1, verify-app-ui 12). Keep #314's copy.
- [ ] Stories and moments keep #314's logic and photos. Only DS-1 codemod renames touch them.
- [ ] No Cult UI, Magic UI or affectUI piece, for the same reason as DS-4a. The public page at `/u/<handle>` uses the same components and gets the same changes.

**You see.**

- [ ] `git grep -n "pitch-tone\|github-heatmap\|bg-success\|bg-warning" -- apps/web/src` prints nothing.
- [ ] The GitHub card shows a grey-to-primary ramp with no green.
- [ ] The unpublished Alert holds a Publish button, and pressing it publishes.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `pitch-workspace-craft.test.tsx` (from #314) green. A new test renders the unpublished state and finds the Publish button inside the alert by role. Green at head.
- [ ] `pitch-public-page.test.tsx` green.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Publish a Pitch and open its public URL at trunk and head. Save `ds4b-regression.png`. Pass when both publish and the public page loads.
- [ ] Lane 2. verify-app-ui 12 and 07. Save `ds4b-publish.png`. Pass when both pass.
- [ ] Lane 3. verify-app-ui 19 and 37 on Pitch. Save `ds4b-color.png`. Pass when both pass.
- [ ] Lane 4. verify-app-ui 20 on the heatmap labels and badges. Save `ds4b-contrast.png`. Pass when it passes.
- [ ] Lane 5. verify-app-ui 25 with an open story (timer pauses under reduce). Save `ds4b-reduce.png`. Pass when it passes.
- [ ] Lane 6. verify-app-ui 24 and 05. Save `ds4b-motion.png`. Pass when both pass.
- [ ] Lane 7. Public page at 390x844. Save `ds4b-public-390.png`. Pass when nothing scrolls sideways and the copy-link control is 24 px or more.
- [ ] Lane 8. Heatmap accessibility. Snapshot the graph. Save `ds4b-graph-a11y.png`. Pass when the graph has a text total or label a screen reader reaches.
- [ ] Lane 9. verify-app-ui 31, 32, 28 on Pitch. Save `ds4b-structure.png`. Pass when all pass.
- [ ] Lane 10. Gates. `scripts/review-pr.sh <pr#>`. Save `ds4b-gates.png`. Pass when it prints `OK`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Metric A on the Pitch route chunk and the public-page chunk. Metric B on Pitch.
- [ ] Probe. Three builds and three checker runs per side, interleaved trunk then head, in two worktrees, per the perf method.
- [ ] Baseline. Trunk medians first.
- [ ] Rule. Each chunk at most +8 KB gzip (`date-fns` functions plus the graph), Pitch under 2000 ms. A larger number fails.

**Risks.** The public page is what a recruiter sees, so lane 1 and lane 7 cover it. Grey-to-primary loses the familiar GitHub green, which is the intended effect of removing the hex exception.

**Review gate.** The operator reviews before merge.

- [ ] Save lanes 1, 3 and 7 screenshots and a 30 to 60 second video of the editor, publish, and the public page as `/home/quan/tmp/opencv-review/DS-4b-review.mp4`. Post them in chat for the operator. Stop at merge-ready.

**Merge.**

- [ ] `review-pr.sh` OK, gates green at the exact head, independent review clean, then `gh pr merge <pr#> --squash --admin` and cleanup.
