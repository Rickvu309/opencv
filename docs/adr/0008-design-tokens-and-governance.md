# Design tokens and governance: monochrome + status hues, light-only, vocabulary lock

Decisions for Spec 6, grounded in the 2026-08-26 audit (`docs/research/2026-08-26-design-system-audit.md`). Supersede only with a follow-up ADR.

**Color: the monochrome identity is deliberate.** OpenPath stays achromatic — calm under uncertainty, made visual. No brand accent hue. What gets added is *meaning*: semantic status tokens (`--success`, `--warning`, `--info` with foreground pairs), a genuinely differentiated `--chart-1..5` ramp so the Apply stage dots communicate, and one token-backed tone table for Pitch's warm gradients replacing the three incompatible raw-Tailwind maps (and one tone union across all Pitch types). Raw hex and named Tailwind palette classes are forbidden in app code, with exactly two documented exceptions: CV print paper (paper is white) and the mock GitHub heatmap ramp (tokenized as its own variables).

**Typography: a scale instead of 90 pixel literals.** Micro-label tokens for the de facto 9–11px tier, documented roles (page-title, section-title, body, label, micro) mapped to the scale, and `--font-heading` becomes the serif display stack currently inlined in Home and auth — one source for the product's display voice. One shared prose treatment serves both the Coach markdown and the Paper editor canvas.

**Motion, shadow, depth: small token sets, one press affordance.** Durations fast/base/slow (100/150/200ms), named easings, shadow and z-index scales, the kit's `active:translate-y-px` as the single press affordance. Global `prefers-reduced-motion` handling; the auto-advancing Pitch story viewer pauses under it.

**Dark mode: parked, deliberately.** Light-only for now. The undocumented `d` hotkey is removed; the `.dark` token block stays in place, dormant; Storybook's misleading dark background goes. Revisit when real users ask — the revival ticket is filed at Spec 6 close.

**Package hygiene.** Feature CSS leaves the kit: the Paper/Proof/CV/A4/print rules move to an app-level stylesheet, and the A4 page height gets one source (the CSS variable; TS reads it). The focus ring and `use-media-query` promote into the kit — one focus treatment, exported from the design system, used by every raw interactive element that can't be a kit component. The leftover `.dark --sidebar-primary` purple is corrected. The dangling `button-group`/`kbd` style hooks get their components.

**Kit expansion, per ADR-0002 absorb rule:** card, label, textarea, select, separator, popover, skeleton, spinner, empty-state, kbd, button-group. App-level shared blocks (`WorkspaceHeader`, `ErrorBanner`, the single `ComingSoon` affordance) stay in `apps/web` under the promotion rule until a second app needs them.

**Governance: the vocabulary is enforced, not requested.** Storybook's build joins CI (the built-CSS assertion finally runs); a vocabulary test forbids raw hex + palette classes outside the documented exceptions; the kit contract test derives its component list from the directory instead of a hardcoded allowlist; Storybook gains Foundations/Tokens documentation pages and the a11y addon. ADR-0002 gains the token-vocabulary rule so agents inherit it.

**Out of scope:** brand accent exploration, dark mode revival, Figma sync, spacing-rhythm tokens beyond stock Tailwind (audit found spacing broadly on-scale) — all filed as follow-ups at Spec 6 close.
