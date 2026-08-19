# Opath (Lab)

The design-system package. Opath (Production) consumes it. Same git repo; separate tree so two agents (or two people) can work in parallel without a second remote.

## What lives here

Primitives and shared layout pieces: Button, Input, Collapsible, Mark, stories. No product nouns, no `core/` imports, no feature screens.

Coach chrome (reasoning panel, tool call, composer, rail) stays in `src/features/coach/`. That is Production assembly on top of these primitives.

Tokens stay in `src/styles/globals.css` until they are stable enough to move. Token edits are the shared seam: change `docs/design-system/tokens.md` in the same PR.

## How Production consumes it

`@/ui/button` resolves here via the root tsconfig path. Do not publish to npm yet.

## Local Storybook

```bash
npm run storybook:lab         # Opath (Lab), http://localhost:6007
npm run storybook             # both (Production :6006, Lab :6007)
```

## Parallel work

| Workstream | Owns | Does not touch |
|---|---|---|
| Opath (Lab) | `packages/opath-ui/**`, `docs/design-system/**`, Lab Storybook | `src/features/**`, `src/core/**`, commands, routes |
| Opath (Production) | `src/features/**`, `src/core/**`, `src/routes/**` | primitive internals in this package. Compose them. If a screen needs a new primitive, add the block in `docs/design-system/components.md` and land it here first |

Shared on purpose: `src/styles/globals.css`, `docs/copy.md` (words), `docs/design.md`.

Sourced galleries live in `src/lab`. Storybook shows them as `Lab/Components/*` and `Lab/Templates/*` (not by kit name). They are review surfaces. Production keeps importing `@/ui/button` from the package root.
