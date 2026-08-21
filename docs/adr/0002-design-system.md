# Design system: absorb-when-possible, shadcn-style, Storybook catalog

OpenPath grows UI by curation, not by inventing a full custom kit up front. This ADR records how the design system works; supersede it when the approach changes on purpose.

**Model:** Prefer owned UI in `packages/ui`. When something useful appears (link, registry item, block), **absorb it if it can** become owned code (e.g. shadcn CLI/`add`, port). If it cannot, compose from what we already own and invent only the gap. After absorb, **owned code and Storybook** are the source of truth—not the original link.

**Stack shape:** shadcn-style components live as source in `packages/ui` (official monorepo pattern). Every CLI workspace has its own `components.json`, with `style`, `baseColor`, and `iconLibrary` aligned and Tailwind v4 `tailwind.config` left empty. Run `add` from `apps/web` so primitives land in `packages/ui` and page blocks stay in the app. Theme tokens live as CSS variables in `packages/ui/src/styles/globals.css`; the package exposes components, hooks, lib, and that CSS through `exports`. Web imports only through those exports (`@workspace/ui/globals.css`, `@workspace/ui/components/button`). Tailwind v4 `@source` in the shared stylesheet covers package and app sources so kit classes are generated. Page-level blocks may land in `apps/web` first and move into `packages/ui` when reused. Storybook documents what we own and is hosted on Vercel (build from `packages/ui`; a separate `apps/storybook` is optional).

**Agent expectation:** Prefer existing `packages/ui` / Storybook → else absorb from registry when possible → else invent the gap.

**Out of scope here:** Exact theme tokens, Figma as source of truth, and requiring Storybook before every absorb.
