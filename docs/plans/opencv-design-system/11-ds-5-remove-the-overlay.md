## Remove the overlay and the dead CSS (DS-5)

**Depends on.** DS-2, DS-3, DS-4a, DS-4b merged.

**Files.**

- [ ] Delete `packages/ui/src/styles/legacy-overlay.css` and its import in `globals.css`.
- [ ] Delete `packages/ui/src/components/section.tsx`. Edit `apps/web/src/features/landing/landing-footer.tsx`, `landing-nav.tsx`, `landing-hero.tsx`, `landing-page.tsx`, `landing-surface.tsx`.
- [ ] Edit `apps/web/src/test/design-vocabulary.test.ts` (remove `LEGACY_OVERLAY_ALLOWLIST`), `apps/web/src/test/ui-kit-contract.test.ts`.
- [ ] Edit `docs/adr/0002-design-system.md` and `docs/adr/0010-design-tokens-and-governance.md` status lines to `Superseded`, and `docs/adr/0014-shadcn-design-system.md` to drop its transition note.
- [ ] Edit `.claude/skills/verify-landing/SKILL.md` description (drop `section`, `text-reveal`).

**Build.**

- [ ] Inline `Section` and `SectionContainer` as the exact classes from `section.tsx` so the landing renders pixel-identical.
- [ ] Remove the allowlist and its test. The vocabulary test now has one exception, the CV print paper.
- [ ] Run `node scripts/ds-codemod.mjs --dry-run` and the `git grep` from DS-1 You see. Both print zero.

**You see.**

- [ ] `git grep -nE "legacy-overlay|components/section|LEGACY_OVERLAY" -- apps packages` prints nothing.
- [ ] `globals.css` `:root` holds only the stock set, `--radius`, and nothing else. The four motion tokens live in `@theme inline`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `pnpm --filter web test -- design-vocabulary ui-kit-contract ui-kit-styled` green at head. A scratch use of `--pitch-tone-warm` turns it red, then is dropped.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. verify-landing full run on trunk and head. Save `ds5-landing.png`. Pass when the 25 properties match.
- [ ] Lane 2. Landing screenshots at 1440x900 and 390x844 on both sides, compared with `compare -metric AE` if ImageMagick is installed, else side by side. Save `ds5-parity.png`. Pass when 0 pixels differ outside animated regions, or each difference is listed and explained.
- [ ] Lane 3. verify-app-ui tour on Home and the Thread at trunk and head. Save `ds5-home.png`. Pass when head fails no property trunk passes.
- [ ] Lane 4. verify-app-ui tour on Paper and the open CV at trunk and head. Save `ds5-paper.png`. Pass when head fails no property trunk passes.
- [ ] Lane 5. verify-app-ui tour on Apply at trunk and head. Save `ds5-apply.png`. Pass when head fails no property trunk passes.
- [ ] Lane 6. verify-app-ui tour on Pitch and the public page at trunk and head. Save `ds5-pitch.png`. Pass when head fails no property trunk passes.
- [ ] Lane 7. verify-app-ui tour on all four surfaces at 390x844 at trunk and head. Save `ds5-mobile.png`. Pass when head fails no property trunk passes.
- [ ] Lane 8. verify-app-ui 37 across the tour. Save `ds5-colors.png`. Pass when it passes.
- [ ] Lane 9. Built CSS. `pnpm turbo build --filter=web` then `grep -c "pitch-tone\|github-heatmap\|text-micro"` on the built stylesheet. Save `ds5-css.png`. Pass when the count is 0.
- [ ] Lane 10. Gates. `scripts/review-pr.sh <pr#>`. Save `ds5-gates.png`. Pass when it prints `OK` (not `HUMAN REQUIRED`, since the deletion is a few files, far under the 25 percent mass-deletion line).

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. CSS gzip bytes and entry JS gzip bytes, trunk then head.
- [ ] Probe. Three builds per side, interleaved trunk then head, in two worktrees.
- [ ] Baseline. Trunk medians first.
- [ ] Rule. Head CSS no larger than trunk, entry JS within 0.5 KB. A larger number fails.

**Review gate.** None. DS-5 is not review-gated.

**Merge.**

- [ ] `review-pr.sh` OK, gates green at the exact head, independent review clean, then `gh pr merge <pr#> --squash --admin` and cleanup.
