# Design-system audit — kit and consumption

**Date:** 2026-08-26 · **Scope:** `packages/ui` + all of `apps/web/src` at main (post Spec 5) · **Feeds:** Spec 6, ADR-0008

## Summary

Strong but thin foundation, drifting at the consumption edge. The color problem is localized (Pitch + CV templates), not systemic; the coverage problem is universal (no containment, form, or feedback layer). The kit is dark-ready; the app is not; nothing exposes dark mode anyway.

## The kit (`packages/ui`)

- 8 primitives on **Base UI** (shadcn `base-nova` style): button, badge, input, avatar, tabs, tooltip, dialog, dropdown-menu. 100% story coverage, **enforced** by `storybook-catalog.test.ts` (every component must have a colocated story). Two variant idioms coexist: cva (button/badge/tabs) vs data-attributes (avatar).
- Tokens (`src/styles/globals.css`, Tailwind v4, `@theme inline`): full semantic shadcn color set in oklch — **entirely achromatic**, including `--chart-1..5` (five greys). Radius scale is genuinely good (one primitive, 7 computed steps). A real `.dark` block exists with full parity.
- **Token gaps:** no typography tokens (only `--font-sans`; `--font-heading` aliases it and is unused), no spacing rhythm, no shadow, no motion (durations/easings hardcoded per site), no z-index scale, no status colors (only `--destructive`).
- **Hygiene:** ~140 lines (54%) of the kit stylesheet is Paper/Proof/CV/A4/print CSS — app CSS in the design system. `A4_HEIGHT_PX` in TS duplicates `--cv-page-height`. `.dark --sidebar-primary` is a leftover shadcn purple. `src/hooks/` is an enforced-but-empty export. Dangling style hooks for nonexistent `button-group` and `kbd` components.
- **Storybook:** 8 thin stories, docs addon only. Dark background option renders light tokens on a dark canvas (no `.dark` class ever applied). **`build-storybook` never runs in CI** — a broken story only fails the Vercel deploy, and the built-CSS assertion is permanently skipped.
- Contracts that work: `ui-kit-contract.test.ts` (CLI config alignment, exports, prototype-import guard), `ui-kit-styled.test.ts` (kit classes survive production build). Blind spots: hardcoded 8-primitive allowlist; nothing forbids raw hex/palette classes; nothing renders or checks a11y.

## Consumption (`apps/web`)

**Bypass census:** 65 raw `<button>` vs 34 kit `<Button>` (66% bypass; worst: pitch-stories ×11); 15 raw `<input>` (79% bypass); 6 raw `<textarea>`, 1 raw `<select>` (no kit equivalents). Three hand-rolled portal popovers (paper-ai-chat, paper-toolbar-parts, paper-cv-template-picker) with manual positioning/dismiss and **no focus management** — everything the kit dialog/menu provides free.

**Color:** 11 hex-literal sites (notably `bg-[#FAFAFA]` on three workspace roots), 22 named-palette lines (92% in Pitch), 54 white/black literals. Pitch has **three incompatible tone→gradient maps** with three different tone unions (3/4/5 values). Apply stage dots use `--chart-*` — which are grey, so the ramp conveys nothing. Two lone leaks in otherwise-clean features: `app-sidebar.tsx` sky-500 dot, `thread-view.tsx` emerald-600 receipt check.

**Typography:** 90 arbitrary `text-[Npx]` across 18 files. Page titles differ on every surface (`text-2xl` / `text-lg` / `text-sm` / an inlined serif stack duplicated in Home + auth while `--font-heading` sits unused). Two prose scales (CoachMarkdown vs `.paper-editor-canvas`).

**Duplication wanting components:** panel card ×6, fake input ×7, empty state ×8 shapes, workspace header ×4 (2 char-identical), error banner ×2 identical + 3 inline variants, icon-button pattern ×11 (kit `size="icon-sm"` exists, unused), status pill ×5, "Coming soon" in **4 different affordances**, loading in 4 unrelated approaches.

**Focus rings: 5 treatments**, including `FOCUS_RING` in `features/app-shell/` — a string copy of the kit's ring, imported cross-feature, zero usage in paper/apply/pitch (most raw buttons have no visible focus at all).

**Motion:** ~50 transitions with no duration, 3 easings total, three different press affordances, **zero `prefers-reduced-motion` handling** (the auto-advancing Pitch story viewer is most exposed).

**Dark mode:** the 189-line theme-provider works (system/light/dark, storage sync) but exposes no context/hook and is triggered only by an undocumented `d` keypress; exactly one `dark:` utility exists in the app; the hardcoded near-white workspace roots and Pitch pills guarantee visual breakage.

**What's already consistent (protect, don't rewrite):** neutral-token discipline across 39 files (app-shell/home/apply/auth ~100% clean), single enforced token source, radius on-scale (147/149), lucide icons uniform, universal `cn()`, centralized surface copy, strong test-asserted `aria-label` coverage, and the Coach feature is the cleanest code in the repo.

## Resolution

Spec 6 (`docs/specs/spec-6-design-system.md`) addresses this in three tickets: kit (tokens + components + Storybook/CI), migration sweep, guardrail lock. Decisions in ADR-0008.
