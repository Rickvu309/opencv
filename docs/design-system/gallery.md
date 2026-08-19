# Production gallery

How Opath (Production) Storybook is organised. This gallery **is** the design system made reviewable. Opath (Lab) is a sourced commodity catalog, not a second system.

Local: `npm run storybook:production` (port 6006). Hosted: https://opath-production.up.railway.app. Lab stays on 6007 / https://opath-lab.up.railway.app.

## Sidebar

Four chapters, in this order. A new story picks a chapter; it does not invent a fifth.

| Chapter | Owns | Does not |
|---|---|---|
| **Foundations** | Tokens made visible: color, type, space, motion | Components, screens |
| **Components** | One entry per primitive in `packages/opath-ui`. Variants and states as named stories | Product nouns, fetched data |
| **Patterns** | Blocks assembled: drive list, sectioned form, suggestion chips | A whole product screen |
| **Screens** | Feature views from `src/features/*/`. The conversation's artifacts | Primitive internals |

Reading order matches [README.md](README.md): tokens, then templates in [components.md](components.md), then a screen assembled from those templates.

## Foundations

Live values from `src/styles/globals.css` — swatches read `var(--token)`, they do not hardcode hex. Type specimens include Vietnamese ("Nguyễn Thị Ngọc Ánh", "trường đại học") per [tokens.md](tokens.md). Status hues appear only inside chips, never as text or fills.

## Components

If a surface takes props, it gets a story here. Named stories are the states in [components.md](components.md) (rest, hover, focus, invalid, disabled, loading) — not a junk drawer. Copy in these stories is generic: Continue, Email, Row label. Product words live under Screens.

## Patterns

A pattern is two or more components in the layout they actually occupy: Band over Rows, Section over FieldRow, EmptyState under a Band. When a screen needs a new assembly, add the pattern first, then the screen.

## Screens

Feature Storybook titles are `Screens/<Place>` (`Screens/Auth`, `Screens/Coach`, `Screens/Paper`). Layout follows the product: fullscreen for Auth, Landing, Onboarding, Share; padded for the rest. Screens compose `@/ui/*`; they do not restyle primitives.

## Lab

Opath (Lab) is `Lab/Components/*` and `Lab/Templates/*` — sourced kits for review ([clone-sources.md](clone-sources.md)). Kit controls that have a Production counterpart restyle to these tokens. Lab login templates are not product auth; product auth is `Screens/Auth`.

## Adding a story

1. Primitive: land the component in `packages/opath-ui`, spec the block in [components.md](components.md), add a `Components/<Name>` story in `packages/opath-ui/src/gallery/`.
2. Pattern: write the assembly in `patterns.stories.tsx` with generic copy.
3. Screen: a story next to the view in `src/features/<name>/`, title `Screens/<Place>`.
