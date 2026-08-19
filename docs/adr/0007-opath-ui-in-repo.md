# ADR 0007: Opath is an in-repo package, not a second git remote

## Context

Opath (Lab) and Opath (Production) need to move in parallel. Splitting a second GitHub repo would mean versioning, publishing, and consuming a moving design system while Coach chrome is still being cloned. A single folder (`src/ui/`) mixed app-wired helpers (command toast, notification bell) with primitives, so two workstreams stepped on each other.

## Decision

Keep one git repo. Extract primitives into `packages/opath-ui` (`@opath/ui`), private, not published. Opath (Production) keeps importing `@/ui/button`; the root tsconfig maps that path at the package. App-wired helpers that import `core/` stay in `src/ui/` (`run-command`, `notifications`). Coach chrome stays in `src/features/coach/`.

Two workstreams in one clone:

| Workstream | Owns |
|---|---|
| Opath (Lab) | `packages/opath-ui/**`, `docs/design-system/**`, Lab Storybook |
| Opath (Production) | `src/features/**`, `src/core/**`, `src/routes/**` |

The shared seam is tokens (`src/styles/globals.css`) and copy (`docs/copy.md`).

## Rejected

- A second git remote: publish/bump tax while the primitive API is still being discovered.
- Moving Coach chrome into the package: reasoning panel and tool call are product assembly, not primitives.
- Publishing `@opath/ui` to npm: no second consumer yet.

## Consequences

`npm run typecheck:ui` typechecks the package alone. Local Storybook is two galleries: Opath (Production) on 6006, Opath (Lab) on 6007 (`npm run storybook`). Extracting a real npm package later is a copy of this folder plus a publish step, not a redesign. This does not change ADR 0001 (one deployable codebase).
