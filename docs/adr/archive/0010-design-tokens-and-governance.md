# Design tokens and governance: monochrome + status hues, light-only, vocabulary lock

**Status.** Superseded by ADR-0014 (`docs/adr/0014-shadcn-design-system.md`).

Decisions for Spec 6, grounded in the 2026-08-26 audit (`docs/research/2026-08-26-design-system-audit.md`). Agent-facing absorb + vocabulary rules live in ADR-0002; this file is the token and governance record. Supersede only with a follow-up ADR.

**Color: the monochrome identity is deliberate.** OpenPath stays achromatic — calm under uncertainty, made visual. No brand accent hue. What gets added is _meaning_: semantic status tokens (`--success`, `--warning`, `--info` with foreground pairs), a genuinely differentiated `--chart-1..5` ramp so the Apply stage dots communicate, and one token-backed tone table for Pitch's warm gradients replacing the three incompatible raw-Tailwind maps (and one tone union across all Pitch types). Raw hex and named Tailwind palette classes are forbidden in app code, with exactly two documented exceptions: CV print paper (paper is white) and the mock GitHub heatmap ramp (tokenized as its own variables).

**Typography: a scale instead of 90 pixel literals.** Micro-label tokens for the de facto 9–11px tier, documented roles (page-title, section-title, body, label, micro) mapped to the scale, and `--font-heading` becomes the serif display stack currently inlined in Home and auth — one source for the product's display voice. One shared prose treatment serves both the Coach markdown and the Paper editor canvas.

**Motion, shadow, depth: small token sets, one press affordance.** Durations fast/base/slow (100/150/200ms), named easings, shadow and z-index scales, the kit's `active:translate-y-px` as the single press affordance. Global `prefers-reduced-motion` handling; the auto-advancing Pitch story viewer pauses under it.

**Dark mode: parked, deliberately.** Light-only for now. The undocumented `d` hotkey is removed; the `.dark` token block stays in place, dormant; Storybook's misleading dark background goes. Revisit when real users ask — revival is [QVE-164](https://linear.app/quanvm/issue/QVE-164).

**Package hygiene.** Feature CSS leaves the kit: the Paper/Proof/CV/A4/print rules move to an app-level stylesheet, and the A4 page height gets one source (the CSS variable; TS reads it). The focus ring and `use-media-query` promote into the kit — one focus treatment, exported from the design system, used by every raw interactive element that can't be a kit component. The leftover `.dark --sidebar-primary` purple is corrected. The dangling `button-group`/`kbd` style hooks get their components.

**Kit expansion, per ADR-0002 absorb rule:** card, label, textarea, select, separator, popover, skeleton, spinner, empty-state, kbd, button-group. App-level shared blocks (`WorkspaceHeader`, `ErrorBanner`, the single `ComingSoon` affordance) stay in `apps/web` under the promotion rule until a second app needs them.

**Governance: the vocabulary is enforced, not requested.** Storybook's build joins CI (the built-CSS assertion finally runs); a vocabulary test forbids raw hex + palette classes outside the documented exceptions; the kit contract test derives its component list from the directory instead of a hardcoded allowlist; Storybook gains Foundations/Tokens documentation pages and the a11y addon. ADR-0002 carries the token-vocabulary rule so agents inherit it. The lock lives in `apps/web/src/test/design-vocabulary.test.ts` (hex/palette + raw-interactive adoption) and `apps/web/src/test/ui-kit-contract.test.ts` (directory-derived kit surface).

**Out of scope:** brand accent exploration ([QVE-165](https://linear.app/quanvm/issue/QVE-165)), dark mode revival ([QVE-164](https://linear.app/quanvm/issue/QVE-164)), Figma sync ([QVE-166](https://linear.app/quanvm/issue/QVE-166)), spacing-rhythm tokens beyond stock Tailwind ([QVE-167](https://linear.app/quanvm/issue/QVE-167)) — audit found spacing broadly on-scale. All filed at Spec 6 close (QVE-159).
