## Make the web tests assert behavior (PR-14)

**Depends on.** PR-13.

**Files.**

- [ ] Delete `apps/web/src/test/paper-seam.test.ts`.
- [ ] Delete `apps/web/src/test/apply-seam.test.ts`.
- [ ] Delete `apps/web/src/test/pitch-seam.test.ts`.
- [ ] Delete `apps/web/src/test/starter-seam.test.ts`.
- [ ] Delete `apps/web/src/test/auth-seam.test.ts`.
- [ ] Create `apps/web/src/test/surface-behavior.test.tsx`.
- [ ] Edit `apps/web/eslint.config.js`.
- [ ] Edit `apps/web/src/routes/paper.test.tsx`.
- [ ] Create `apps/web/src/test/mock-http.ts`.
- [ ] Edit `apps/web/src/test/threads-api-mock.ts`.
- [ ] Edit `apps/web/src/test/paper-api-mock.ts`.
- [ ] Edit `apps/web/src/test/apply-api-mock.ts`.
- [ ] Edit `apps/web/src/test/profile-api-mock.ts`.
- [ ] Edit `apps/web/src/test/pitch-api-mock.ts`.

**Build.**

- [ ] Delete the shell-import and Outlet cases that only mirror source text, namely the "mounts ... from the feature module", "keeps the ... workspace free of shell chrome imports" and "lets the shell swap ... only through the layout Outlet" cases in `paper-seam.test.ts` (lines 14, 24, 44), `apply-seam.test.ts` (14, 24, 34) and `pitch-seam.test.ts` (25, 35, 45). Replace the import boundary with a `no-restricted-imports` override in `apps/web/eslint.config.js` for `src/features/paper/**`, `src/features/apply/**` and `src/features/pitch/**` that forbids `@/router`, `@/features/app-shell/*` and `@/components/search-modal*`.
- [ ] Delete `auth-seam.test.ts` (it checks that a deleted placeholder module stays deleted) and the file-existence checks in `starter-seam.test.ts`.
- [ ] In `apps/web/src/test/surface-behavior.test.tsx`, keep the product claims the old files protected as rendered tests using the existing api mocks. Case 1 renders Paper, Apply, Pitch and Home with empty api data and asserts the empty states show and no sample card or document text appears (replaces `starter-seam.test.ts:17,35` and `apply-seam.test.ts:61`). Case 2 renders the Pitch workspace with a `fetch` spy and asserts every request URL targets the api origin, never GitHub or a third-party host (replaces `pitch-seam.test.ts:56,67`). Case 3 asserts the Pitch workspace shows no seeded persona name (replaces `pitch-seam.test.ts:86`). Case 4 asserts no Apply surface renders a "Fit" label (replaces `apply-seam.test.ts:45`).
- [ ] In `apps/web/src/routes/paper.test.tsx`, replace the style assertions with role and text queries. Remove the `className` and `toHaveClass` assertions at lines 652 to 656, 686 to 688 and 697 to 702 (the `bg-muted/80`, `border-input` and `rounded-full` checks) and the other class-string checks, and replace `querySelector` lookups (37 today) with `getByRole`, `getByLabelText` or `getByText` where a role exists. Keep the `data-paper-canvas-field` attribute assertions because that attribute is a contract. The `design-vocabulary.test.ts` file keeps guarding classes.
- [ ] Create `apps/web/src/test/mock-http.ts` exporting `isoNow`, `urlOf`, `pathOf`, `jsonOk` and `jsonError`, taken from the identical copies in `threads-api-mock.ts` (lines 108 to 130), `paper-api-mock.ts` (30 to 44), `apply-api-mock.ts` (40 to 58), `profile-api-mock.ts` (34 to 44) and `pitch-api-mock.ts` (48 to 79). Delete the local copies and import from `./mock-http.ts`. Do not change what any mock returns. `threads-api-mock.ts` (652 lines) must end under 600.

**You see.**

- [ ] `ls apps/web/src/test/*-seam.test.ts` prints no such file.
- [ ] `grep -c "querySelector" apps/web/src/routes/paper.test.tsx` prints at most 10 (trunk 37) and `grep -c "toHaveClass\|className" apps/web/src/routes/paper.test.tsx` prints at most 5 (trunk 28).
- [ ] `grep -rn "function jsonOk" apps/web/src/test | wc -l` prints 1 (trunk prints at least 2).
- [ ] `pnpm --filter web lint` prints no errors, and a throwaway import of `@/router` inside `features/paper/` makes it print a `no-restricted-imports` error.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/web/src/test/surface-behavior.test.tsx` is new. Prove each case catches its regression by temporarily make the Pitch workspace call `fetch("https://api.github.com/users/x")` and confirm case 2 is red, then revert and confirm green. Run `pnpm --filter web exec vitest run src/test/surface-behavior.test.tsx`.
- [ ] The lint rule is proven red then green. Add `import "@/router.tsx"` to `apps/web/src/features/paper/paper-workspace.tsx`, run `pnpm --filter web lint` and see the error, then remove it. Run `pnpm --filter web lint`.
- [ ] `apps/web/src/routes/paper.test.tsx` stays green after the rewrite. Run `pnpm --filter web exec vitest run src/routes/paper.test.tsx`.
- [ ] All five mocks work through `mock-http.ts`. Run `pnpm --filter web test` and expect no failures and no skipped additions beyond the one skip on trunk.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm --filter web test` at trunk and at head and screenshot the summary lines. Save `pr14-suite-trunk-vs-head.png`. Pass when both end with zero failed and head has fewer test files than trunk's 63 by the number of deleted seam files, plus one new file.
- [ ] Lane 2. Empty-state product claim in the browser. Sign up a fresh account on the PGlite api and open Paper, Apply, Pitch and Home. Save `pr14-empty-states.png`. Pass when each surface shows its empty state and no sample document, card or persona name.
- [ ] Lane 3. Pitch makes no third-party calls. Open Pitch with the network panel recording and load the GitHub section. Save `pr14-pitch-network.png`. Pass when every request goes to the api origin or the web origin and none goes to `github.com` or another host.
- [ ] Lane 4. Apply has no Fit label. Add a card and open its detail. Save `pr14-apply-no-fit.png`. Pass when the board, the card and the drawer show no "Fit" label.
- [ ] Lane 5. Paper canvas behavior that the rewritten tests cover. Open a CV, click a canvas field, type, and press Enter in a bullet. Save `pr14-paper-canvas-behavior.png`. Pass when the field is editable via its role and label and `data-paper-canvas-field` is present.
- [ ] Lane 6. Lint boundary. In a lane worktree add `import "@/router.tsx"` to `features/apply/apply-workspace.tsx` and run `pnpm --filter web lint`. Save `pr14-lint-boundary-red.png`. Pass when lint prints a `no-restricted-imports` error naming that line, and prints none after the line is removed.
- [ ] Lane 7. Mock helper dedup. Run `grep -rn "function pathOf\|function jsonOk\|function isoNow\|function jsonError" apps/web/src/test` at trunk and head. Save `pr14-mock-helper-grep.png`. Pass when head lists each function once, in `mock-http.ts`, and trunk lists at least 12 definitions.
- [ ] Lane 8. Style-coupling removed. Run `grep -n "toHaveClass\|className" apps/web/src/routes/paper.test.tsx` at head. Save `pr14-paper-test-style-grep.png`. Pass when at most 5 lines print and none matches `bg-`, `border-` or `rounded-`.
- [ ] Lane 9. Rename survives. In a lane worktree make a harmless refactor such as renaming a local variable inside `PaperWorkspace` and add a blank line to `apps/web/src/features/apply/apply-workspace.tsx`, then run `pnpm --filter web test`. Save `pr14-harmless-rename.png`. Pass when the suite stays green (trunk's seam tests would fail on a rename of an exported symbol they regex).
- [ ] Lane 10. Audit lane. Read `git diff --stat trunk...HEAD` and the coverage map in the PR body that pairs each deleted seam case with its replacement. Save `pr14-coverage-map.png`. Pass when every deleted case is either replaced by a named test, replaced by the lint rule, or listed as source-mirror-only with the reason.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time of `pnpm --filter web test` and the count of source-text assertions (`readFileSync` in `apps/web/src/test`).
- [ ] Probe. At trunk and at head, interleaved, run `/usr/bin/time -f %e pnpm --filter web test` three times each and take the median, then `grep -rln "readFileSync" apps/web/src/test | wc -l`.
- [ ] Baseline. Record the trunk values first. The audit measured 112.6 s for 63 files and five seam files that read source text.
- [ ] Rule. Fail if the head median wall time is more than 3 percent above trunk, or if any seam test file that reads source text remains.

**Review gate.** None. PR-14 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] The owner squash-merges its own PR with the PR title as the commit subject and a blank body.
