# Design system: stock shadcn on base-nova, no custom tokens

**Status.** Accepted. Supersedes ADR-0002 and ADR-0010.

**Context.** ADR-0002 and ADR-0010 built an OpenPath overlay on top of shadcn: status hues, a pitch tone table, a heatmap hex ramp, a serif heading stack, named type roles, a micro text tier, three z and shadow scales, four durations and edited copies of the kit files. Each addition made the next `shadcn add` a merge. The operator's rule is to stay on current shadcn/ui with its own CSS variables and spend design effort on the product.

**Decision.**

1. The style is `base-nova` on `@base-ui/react`. Registry pieces that ship a Base UI variant, or no primitive library, drop in. A pasted `asChild` becomes a `render` prop.
2. CSS variables are shadcn's own, as `shadcn init -b base` writes them for the `neutral` base color: the background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, `chart-1..5` and `sidebar-*` families, plus `--radius`. A new variable fails `apps/web/src/test/design-vocabulary.test.ts` until that test and this ADR change.
3. Motion is two tokens in `@theme inline`, `--duration-micro` 150 ms with `--ease-micro` `cubic-bezier(0.22, 1, 0.36, 1)` for micro-interactions, and `--duration-panel` 280 ms with `--ease-panel` `cubic-bezier(0.32, 0.72, 0, 1)` for panels and drawers. `--default-transition-duration` and `--default-transition-timing-function` point at the micro pair. The global `prefers-reduced-motion` block stays.
4. Sources, in order: shadcn/ui, shadcn AI Elements patterns copied into `apps/web/src/components/ai-elements/`, Kibo UI for heavy app pieces, then Cult UI, Magic UI and free affectUI items for showpieces. Install through the shadcn CLI. Colors a registry piece brings map to shadcn variables. A registry piece never adds a token.
5. The CV print paper (`apps/web/src/styles/paper.css`, `features/paper/cv-templates/`) is the one documented exception: print layout where paper is white keeps its own variables and hex.
6. `scripts/ds-codemod.mjs` renames the retired names (`text-micro`, `text-body`, `font-heading`, `ease-standard`, `z-popover` and the rest) to stock Tailwind. Run it with `--dry-run` after every `shadcn add`.

**Enforcement.** `apps/web/src/test/design-vocabulary.test.ts` allows only the stock color utilities and `var(--*)` names plus the four motion tokens, pins the `:root` variable set, forbids the retired class roots, raw hex, functional colours other than black shadows, and named palette classes in app and kit files (one allowlist entry, the CV print paper), and keeps the raw-interactive rule. Only the affectUI kit files may read their own `--ui-<widget>-*` variables. `apps/web/src/test/ui-kit-contract.test.ts` asserts the exact stock variable set and the motion tokens. `pnpm --filter web test` fails on a violation.

**Consequences.** Headings use Geist with `tracking-tight`, not the serif stack. The 9 to 11 px text tier becomes `text-xs`. Shadows and z-index resolve to Tailwind's stock values. Storybook is already gone (ADR-0013). Dark mode stays dormant: the `.dark` block is CLI output and nothing toggles it.
