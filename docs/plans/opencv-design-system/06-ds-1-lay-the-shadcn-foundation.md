## Lay the shadcn foundation (DS-1)

**Depends on.** #308 and #314 merged.

**Files.**

- [ ] Edit `packages/ui/src/styles/globals.css`.
- [ ] Create `packages/ui/src/styles/legacy-overlay.css` (temporary, deleted in DS-5).
- [ ] Edit `apps/web/components.json`, `packages/ui/components.json`, `packages/ui/package.json`, `pnpm-lock.yaml`.
- [ ] Re-add the 18 stock kit files under `packages/ui/src/components/`. Add `empty.tsx`.
- [ ] Delete `packages/ui/src/components/text-reveal.tsx`, `packages/ui/src/components/empty-state.tsx`.
- [ ] Edit `packages/ui/src/lib/utils.ts`.
- [ ] Create `scripts/ds-codemod.mjs`.
- [ ] Edit every app file the codemod changes (about 35, listed in its dry-run output).
- [ ] Edit `apps/web/src/styles/paper.css` (dead `cv-type-*` rules out, renames in).
- [ ] Rewrite `apps/web/src/test/design-vocabulary.test.ts` and `apps/web/src/test/ui-kit-contract.test.ts:56-90`.
- [ ] Create `docs/adr/0014-shadcn-design-system.md`. Add a `Superseded by ADR-0014` line to `docs/adr/0002-design-system.md` and `docs/adr/0010-design-tokens-and-governance.md`.
- [ ] Edit `AGENTS.md` lines 93-95. Edit `.claude/skills/verify-app-ui/SKILL.md` (trigger list `empty-state` to `empty`).

**Build.**

- [ ] Confirm the CLI version first with `pnpm view shadcn version`. The registry run read 4.21.1 on npm (A2) while `packages/ui/package.json` pins `^4.22.1`. Record the actual version in the PR body and use it for every command below.
- [ ] Re-run the CLI's own theme output into a scratch Vite app under `~/tmp/ds1-init` with `pnpm dlx shadcn@latest init -t vite -b base` and base color `neutral`. Copy its `:root`, `.dark` and `@theme inline` variable blocks into `globals.css` verbatim. This is the source of "shadcn's own variables".
- [ ] In `globals.css`, keep the imports (lines 1-8) and the reduced-motion block. Add the four motion tokens and the two `--default-transition-*` lines from the inventory, once, in `@theme inline`. Delete everything else the inventory marks DS-1.
- [ ] Move the tokens that later PRs still need (`--pitch-tone-*`, `--github-heatmap-*`, `--success*`, `--warning*`, `--text-3xs/2xs/micro` only if the codemod leaves any) into `legacy-overlay.css`, imported last from `globals.css`. Its header comment names DS-5 as the deletion PR.
- [ ] Re-add the kit with `pnpm dlx shadcn@latest add avatar badge button button-group card dialog dropdown-menu input kbd label popover select separator skeleton spinner tabs textarea tooltip empty --overwrite -c apps/web`. Review each file diff. Keep only fixes that carry a test today (the contract test lists them). Drop the overlay edits.
- [ ] Run `pnpm dlx shadcn@latest migrate cn` (A2). `packages/ui/src/lib/utils.ts` becomes `export { cn } from "cn"`, and `clsx` plus `tailwind-merge` leave `packages/ui/package.json` if nothing else imports them.
- [ ] Write `scripts/ds-codemod.mjs`, a re-runnable rename table over `apps/web/src/**/*.{ts,tsx,css}` and `packages/ui/src/components/**`. It prints a per-rule hit count with `--dry-run` and rewrites without it. The rules are `text-page-title` to `text-3xl`, `text-section-title` to `text-xl`, `text-body` to `text-sm`, `text-label` to `text-xs`, `text-(3xs|2xs|micro)` to `text-xs`, drop `font-heading`, `ease-(standard|emphasized)` to `ease-micro`, `duration-(base|fast)` to `duration-micro`, `duration-slow` to `duration-panel`, `duration-(75|100|150|200)` to `duration-micro`, `duration-(300|500)` to `duration-panel`, `z-(popover|overlay|modal|dropdown)` to `z-50`, `z-sticky` to `z-40`. The script is the lever later `shadcn add` runs reuse, so DS-2 to DS-4b run it after every install.
- [ ] Repoint the three `empty-state` imports to `@workspace/ui/components/empty`.
- [ ] Rewrite `design-vocabulary.test.ts` with these rules.
  - [ ] Allowed color utilities and `var(--*)` names are exactly the stock set (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, `sidebar-*`, each with its `-foreground` pair) plus `--duration-micro`, `--duration-panel`, `--ease-micro`, `--ease-panel`. Any other `--*` read in app or kit code fails, except the CV print variables in `paper.css`.
  - [ ] `globals.css` `:root` declares exactly that set plus `--radius`. A new variable fails until the test and ADR-0014 change.
  - [ ] Forbidden class roots, `text-(3xs|2xs|micro|page-title|section-title|body|label)`, `font-heading`, `ease-(standard|emphasized)`, `duration-(base|fast|slow)`, `duration-\d+`, `z-(raised|dropdown|sticky|overlay|modal|popover|toast|max)`.
  - [ ] Raw hex and named palette classes stay forbidden, with one allowlist entry, the CV print paper.
  - [ ] A `LEGACY_OVERLAY_ALLOWLIST` lists each file still using a `legacy-overlay.css` token, with the PR that removes it on the line above. An entry whose file no longer uses a legacy token fails, so the list only shrinks.
  - [ ] Keep the raw-interactive rule (`:47`, `:69`, `:131-168`) unchanged.
- [ ] Write ADR-0014. Base `base-nova` on Base UI. Variables are shadcn's own. Motion is the two tokens. Sources in order are shadcn/ui, AI Elements patterns copied into `apps/web/src/components/ai-elements/`, Kibo UI for heavy app pieces, then Cult UI, Magic UI, affectUI free for showpieces, colors mapped to shadcn variables. The CV print paper is the one exception. Name the test that enforces it.
- [ ] Rewrite `AGENTS.md` "Design system" to the same five sentences plus the install commands and the line "never add a token; if a registry piece brings one, map it to a shadcn variable".

**You see.**

- [ ] `node scripts/ds-codemod.mjs --dry-run` at head prints 0 for every rule.
- [ ] `git grep -nE "text-(3xs|2xs|micro|page-title|section-title|body)\b|font-heading|ease-standard|z-popover" -- apps/web/src packages/ui/src` prints nothing.
- [ ] `git ls-files packages/ui/src/components/text-reveal.tsx packages/ui/src/components/empty-state.tsx` prints nothing.
- [ ] Home's h1 renders in Geist, not serif, at 1440x900. Pitch stat labels render at 12px.
- [ ] Every app route looks the same as trunk apart from the micro tier, the heading face and stock shadows (lane 1 diff).

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `pnpm --filter web test -- design-vocabulary ui-kit-contract ui-kit-styled` is red at trunk with the new tests (trunk has `text-micro`, `--info`, `ease-standard`) and green at head.
- [ ] A scratch commit that adds `text-micro` to one app file turns `design-vocabulary` red, then is dropped.
- [ ] Full `scripts/check.sh` once at head (lint, typecheck, test).

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. verify-app-ui full tour on trunk and head, screenshots of Home, Paper, the open CV, Apply, Pitch at 1440x900. Save `ds1-regression.png`. Pass when both runs complete and head has no new failing property.
- [ ] Lane 2. verify-app-ui 24 `motion-tokens` and 25 `reduced-motion` at head. Save `ds1-motion.png`. Pass when both pass.
- [ ] Lane 3. verify-app-ui 37 `no-raw-colors` at head, computed against the new `:root`. Save `ds1-colors.png`. Pass when it passes.
- [ ] Lane 4. verify-app-ui 20 `text-contrast` and 21 `target-size-24` at 1440 and 390. Save `ds1-a11y.png`. Pass when both pass.
- [ ] Lane 5. Open every kit-backed overlay once (dialog, popover, dropdown, select, tooltip) on Paper and Apply. Save `ds1-overlays.png`. Pass when each opens above the page, traps focus where stock does, and closes on Escape.
- [ ] Lane 6. verify-app-ui 26 `no-text-reveal`, 31 `one-h1-per-screen`, 35 `spacing-scale`. Save `ds1-structure.png`. Pass when all three pass.
- [ ] Lane 7. Dark-mode dormancy. Toggle `.dark` on `<html>` from devtools. Save `ds1-dark.png`. Pass when no element keeps a light-only overlay color (the `.dark` block is CLI output).
- [ ] Lane 8. verify-landing full run on trunk and head. Save `ds1-landing.png`. Pass when head fails no property trunk passes.
- [ ] Lane 9. Empty states. Clear Apply demo and open an empty Paper list. Save `ds1-empty.png`. Pass when `data-slot="empty"` renders on both with the same copy as trunk.
- [ ] Lane 10. Gates. `scripts/review-pr.sh <pr#>`. Save `ds1-gates.png`. Pass when it prints `OK`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Metric A and B per the perf method, plus CSS gzip bytes of the built stylesheet.
- [ ] Probe. Three builds and three checker runs per side, interleaved trunk then head, in two worktrees, per the perf method.
- [ ] Baseline. Trunk medians first.
- [ ] Rule. Entry JS within +2 KB gzip of trunk, CSS within +1 KB gzip, and no route over 2000 ms (verify-app-ui 34). A larger gap fails.

**Risks.** Re-adding 18 kit files is the largest visual change in the program, so lane 1 compares every surface. The serif heading loss is a voice change the operator may reverse (Appendix B2). `shadcn migrate cn` touches every kit file, and a stale `@/lib/utils` alias in a later registry item is caught by typecheck.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1 and lane 9 screenshots to `/home/quan/tmp/opencv-review/DS-1-*.png` and record a 30 to 60 second video of Home, Paper, Apply and Pitch at head as `/home/quan/tmp/opencv-review/DS-1-review.mp4`.
- [ ] Post them in chat for the operator. Stop at merge-ready.

**Merge.**

- [ ] `review-pr.sh` OK, gates lane green at the exact head SHA, independent review clean.
- [ ] `gh pr merge <pr#> --squash --admin`, then `scripts/cleanup-worktree.sh <issue#>`.
