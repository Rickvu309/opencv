# Production gallery

How Opath (Production) Storybook is organised. This gallery **is** the design system made reviewable: Getting Started, layered sidebar, autodocs, Controls. Opath (Lab) is a sourced commodity catalog, not a second system.

Local: `npm run storybook:production` (port 6006). Hosted: https://opath-production.up.railway.app. Lab stays on 6007 / https://opath-lab.up.railway.app.

Landing page: **Getting Started** (`.storybook/Introduction.mdx`).

## Sidebar

Seven chapters, in this order. A new story picks a chapter; it does not invent an eighth.

| Chapter | Owns | Does not |
|---|---|---|
| **Getting Started** | How to read the gallery, run it, add a story | Tokens, components |
| **Foundations** | Tokens made visible: color, type, space, motion | Components, screens |
| **Core** | `Interactive`, `Hoverable` — the matrix every pick sits on | Buttons, rows, screens |
| **Components** | One entry per primitive in `packages/opath-ui`. `Default` plus named states. Autodocs for the props API | Product nouns, fetched data |
| **Layouts** | Structural chrome: Band, Section, SkipLink | A whole product screen |
| **Patterns** | Blocks assembled: drive list, sectioned form, suggestion chips | A whole product screen |
| **Screens** | Feature views from `src/features/*/`. The conversation's artifacts | Primitive internals |

Reading order matches [README.md](README.md): tokens, then templates in [components.md](components.md), then a screen assembled from those templates.

## Foundations

Live values from `src/styles/globals.css` — swatches read `var(--token)`, they do not hardcode hex. Type specimens include Vietnamese ("Nguyễn Thị Ngọc Ánh", "trường đại học") per [tokens.md](tokens.md). Status hues appear only inside chips, never as text or fills.

## Core

Most screens should not import these. Button, Row, and Chip already sit on them. Stories show the state matrix (empty, selected, disabled) and the hover reveal.

## Components

If a surface takes props, it gets a **co-located** `*.stories.tsx` next to the component, `tags: ["autodocs"]`, and a `Default` story with `args` so Controls work. Named stories are the states in [components.md](components.md) (rest, invalid, disabled, loading) — not a junk drawer. Copy in these stories is generic: Continue, Email, Row label. Product words live under Screens.

## Layouts

Band is the first element inside `main`. Section is a titled block inside an editor. SkipLink is the first focusable control on every page.

## Patterns

A pattern is two or more components in the layout they actually occupy: Band over Rows, Section over FieldRow, EmptyState under a Band. When a screen needs a new assembly, add the pattern first, then the screen.

## Screens

Feature Storybook titles are `Screens/<Place>` (`Screens/Auth`, `Screens/Coach`, `Screens/Paper`). Layout follows the product: fullscreen for Auth, Landing, Onboarding, Share; padded for the rest. Screens compose `@/ui/*`; they do not restyle primitives.

## Lab

Opath (Lab) is `Lab/Components/*` and `Lab/Templates/*` — sourced kits for review ([clone-sources.md](clone-sources.md)). Kit controls that have a Production counterpart restyle to these tokens. Lab login templates are not product auth; product auth is `Screens/Auth`.

## Adding a story

1. Primitive: land the component in `packages/opath-ui`, spec the block in [components.md](components.md), add a co-located `Name.stories.tsx` with title `Components/<Name>` (or `Core/` / `Layouts/`), `tags: ["autodocs"]`, and a `Default` story.
2. Pattern: write the assembly in `gallery/patterns*.stories.tsx` with generic copy.
3. Screen: a story next to the view in `src/features/<name>/`, title `Screens/<Place>`.
