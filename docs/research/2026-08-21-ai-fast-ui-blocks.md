# Research: AI-fast UI via standard blocks (shadcn + Storybook)

**Date:** 2026-08-21  
**Objective:** AI should compose beautiful UI quickly from ecosystem standard blocks/layouts; invent only what is new. OpenPath leans Storybook + shadcn-style in monorepo `packages/ui`.  
**Sources:** Primary only — ui.shadcn.com, storybook.js.org, first-party GitHub, Tailwind official, Vercel where relevant. No secondary blogs.

Related note: [2026-08-21-shadcn-storybook-ui-kit.md](./2026-08-21-shadcn-storybook-ui-kit.md) covers monorepo/Storybook/Vercel hosting in more breadth; this file focuses on **blocks, registries, AI discovery, and compose-vs-invent**.

---

## Summary

shadcn officially ships **Building Blocks** (page sections / multi-file layouts such as dashboards, sidebars, logins) as `registry:block` items, installed via CLI the same way as primitives. In a monorepo, **UI primitives land in `packages/ui`**; **app-level block pieces** (forms, pages) land under the app (e.g. `apps/web/components`). Discovery for agents is first-class via **CLI (`search`/`view`/`add`)**, **MCP**, and **skills** — not via Storybook. Storybook catalogs **what you already own** after install; the registry is **what you can pull**. Ownership is copy-into-repo; theming is CSS variables / presets. Neutral implication: pull standards first, invent only gaps.

---

## 1. What shadcn officially offers for “blocks” / page sections / registries

### Blocks (not just Button)

- Official marketing surface **“Building Blocks for the Web”**: copy/paste page compositions that work with React frameworks; install via `npx shadcn add <name>`. Examples include `dashboard-01` (sidebar + charts + data table), `sidebar-07` / `sidebar-03`, `login-03` / `login-04`. ([Blocks](https://ui.shadcn.com/blocks))
- Post-init docs: “Add a block” with `pnpm dlx shadcn@latest add login-03`, then import/use. ([Your project is ready](https://ui.shadcn.com/docs/new))
- First-party registry payload for `login-03`: `"type": "registry:block"`, `registryDependencies` on primitives (`button`, `card`, `input`, `label`), files typed as `registry:page` (target `app/login/page.tsx`) and `registry:component` (e.g. login form). ([`https://ui.shadcn.com/r/login-03.json`](https://ui.shadcn.com/r/login-03.json))
- `dashboard-01` is likewise `registry:block` with many UI deps (`sidebar`, `chart`, `card`, `table`, …) and a mix of `registry:page`, `registry:file`, and `registry:component` files. ([`https://ui.shadcn.com/r/dashboard-01.json`](https://ui.shadcn.com/r/dashboard-01.json))

### Registry item types (ecosystem distribution)

Official `registry-item` schema / docs define item types beyond single UI primitives, including:

| Type | Official description (abbrev.) |
| --- | --- |
| `registry:block` | Complex components with multiple files |
| `registry:ui` | UI components / single-file primitives |
| `registry:component` | Simple components |
| `registry:page` | Page or file-based routes |
| `registry:hook` / `registry:lib` | Hooks / utils |
| `registry:theme` / `registry:style` / `registry:base` / `registry:font` | Theme, style, design-system, fonts |
| `registry:file` / `registry:item` | Misc / universal |

([registry-item.json](https://ui.shadcn.com/docs/registry/registry-item-json); schema enum at [`https://ui.shadcn.com/schema/registry-item.json`](https://ui.shadcn.com/schema/registry-item.json))

Guidelines for authors: for blocks, required fields include `name`, `description`, `type`, and `files`; clear descriptions help LLMs; list `registryDependencies` accurately. ([Getting Started — Guidelines](https://ui.shadcn.com/docs/registry/getting-started))

### Namespaced / community / private registries

- Run your own registry to distribute components, hooks, pages, config, rules, and other files (any framework that can serve JSON). ([Registry Introduction](https://ui.shadcn.com/docs/registry))
- Install from community registries: `add @[registry]/[name]`; browse Registry Directory. ([Your project is ready](https://ui.shadcn.com/docs/new))
- CLI 3.0: namespaced registries (`@registry/name`), private auth, `view` / `search` / `list`, MCP for all registries; blocks can depend on items across registries (`type: "registry:block"` + cross-namespace `registryDependencies`). ([August 2025 changelog](https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp))
- `components.json` `registries` maps namespaces to URL templates (and optional headers/params). ([components.json](https://ui.shadcn.com/docs/components-json))

---

## 2. Monorepo: where blocks install (`packages/ui` vs `apps/web`)

Official monorepo CLI behavior ([Monorepo](https://ui.shadcn.com/docs/monorepo)):

- Scaffold: `init --monorepo` → workspaces **`web`** and **`ui`** (Turborepo), layout `apps/web` + `packages/ui`.
- Run `add` **from the app path** (`cd apps/web`). The CLI “figures out what type of component you are adding and install[s] the correct files to the correct path.”
- **Primitive example:** `add button` → installs under **`packages/ui`**, updates app import paths.
- **Block example:** `add login-01` → installs `button`, `label`, `input`, `card` under **`packages/ui`**, and the **`login-form` under `apps/web/components`**.
- Requirements: **every workspace** using the CLI has its own `components.json`; keep `style`, `iconLibrary`, and `baseColor` aligned; Tailwind v4 → empty `tailwind.config` in `components.json`; app CSS can point at `../../packages/ui/src/styles/globals.css`.
- Docs explicitly: with those requirements, the CLI installs “**ui components, blocks, libs and hooks** to the correct paths.”

Implication for OpenPath’s `packages/ui` + app split: **shared primitives → UI package; composed block/page pieces → app** is the documented default, not a custom convention.

---

## 3. MCP / CLI / skills as AI discovery surfaces

### CLI

- `add` — install components/blocks (name, URL, or local path); `--dry-run`, `--view`, `--diff`. ([CLI](https://ui.shadcn.com/docs/cli))
- `view` — inspect registry items before install (incl. `@acme/...`). ([CLI](https://ui.shadcn.com/docs/cli))
- `search` / `list` — query registries (`-q`). ([CLI](https://ui.shadcn.com/docs/cli); [changelog](https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp))
- `docs` — fetch component docs/API refs for agents. ([CLI](https://ui.shadcn.com/docs/cli))
- `build` — generate registry JSON for publishing your own blocks. ([CLI](https://ui.shadcn.com/docs/cli); [Getting Started](https://ui.shadcn.com/docs/registry/getting-started))

### MCP

- shadcn MCP lets assistants **browse, search, and install** from configured registries via natural language (e.g. “Find me a login form”, “Build a landing page using hero/features/testimonials from acme”). Explicitly lists **components, blocks, and templates**. ([MCP Server](https://ui.shadcn.com/docs/mcp))
- Cursor config: `.cursor/mcp.json` with `npx shadcn@latest mcp`; init via `mcp init`. ([MCP Server](https://ui.shadcn.com/docs/mcp); [Your project is ready](https://ui.shadcn.com/docs/new))
- Registries come from `components.json`; private registries via env-expanded headers. ([MCP Server](https://ui.shadcn.com/docs/mcp))
- Registry authors: MCP works out of the box if you expose a root `registry` index; recommend clear descriptions and accurate dependencies for AI. ([Registry MCP](https://ui.shadcn.com/docs/registry/mcp))

### Skills

- Official onboarding: `pnpm dlx skills add shadcn/ui` — “access to the full component registry, documentation, and search.” ([Your project is ready](https://ui.shadcn.com/docs/new))

### AI-ready product stance

- Design principles include **AI-Ready**: open code for LLMs to read/understand/improve; shared composable APIs are “predictable for both your team and LLMs.” ([Introduction](https://ui.shadcn.com/docs))
- Suggested prompts include composing signup/settings/dashboard pages from existing pieces. ([Your project is ready](https://ui.shadcn.com/docs/new))

---

## 4. Constraints: customization, ownership, theming

### Ownership / customization model

- “This is **not** a component library. It is how you build your component library.” Contrast with npm install → import; shadcn hands you **actual component code**. Principles: Open Code, Composition, Distribution, Beautiful Defaults, AI-Ready. ([Introduction](https://ui.shadcn.com/docs))
- “Adds the component source code directly to your project… **You own the code** and can customize it however you want.” ([Your project is ready](https://ui.shadcn.com/docs/new))
- First-party GitHub README: “Use this to **build your own component library**.” MIT-licensed. ([shadcn-ui/ui README](https://raw.githubusercontent.com/shadcn-ui/ui/main/README.md))
- `components.json` optional for copy/paste; **required for CLI**. ([components.json](https://ui.shadcn.com/docs/components-json))
- Style and `baseColor` / `cssVariables` are documented as **not changeable after initialization** without reinstall (cssVariables switch: delete and re-install). ([components.json](https://ui.shadcn.com/docs/components-json); [Theming](https://ui.shadcn.com/docs/theming))
- Upstream updates are not a normal `npm update` of opaque components; you edit owned source (open-code tradeoff discussed in Introduction). ([Introduction](https://ui.shadcn.com/docs))

### Theming

- Recommended: **CSS variables** / semantic tokens (`background`, `primary`, sidebar/chart tokens, etc.); override tokens without rewriting component classes. ([Theming](https://ui.shadcn.com/docs/theming))
- Presets: visual theme on ui.shadcn.com → apply with `init --preset` / `apply`; `--only theme|font`. ([Your project is ready](https://ui.shadcn.com/docs/new); [CLI apply](https://ui.shadcn.com/docs/cli))
- Monorepo: shared globals under `packages/ui/src/styles/globals.css`; eject `shadcn/tailwind.css` with `-c packages/ui` when needed (irreversible for that CSS import). ([Monorepo](https://ui.shadcn.com/docs/monorepo); [CLI eject](https://ui.shadcn.com/docs/cli))
- Tailwind v4 scanning ignores `node_modules` / `.gitignore` paths; monorepos may need `@source` or `source(...)` so utilities used in shared packages are detected. ([Detecting classes](https://tailwindcss.com/docs/detecting-classes-in-source-files))

---

## 5. Storybook (catalog of what YOU own) vs registry (what you can pull)

| Surface | Role (from official docs) |
| --- | --- |
| **shadcn registry + CLI/MCP** | Discover and **install** items (UI, blocks, themes, etc.) into the project as source. ([Registry](https://ui.shadcn.com/docs/registry), [MCP](https://ui.shadcn.com/docs/mcp), [CLI](https://ui.shadcn.com/docs/cli)) |
| **Storybook** | Develop/test UI **in isolation**; load stories from monorepo package dirs; publish static catalog for review. ([Configure](https://storybook.js.org/docs/configure), [Publish](https://storybook.js.org/docs/sharing/publish-storybook), [React Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite)) |

Details:

- Storybook default: colocate `*.stories.*` with components; `stories` config supports `directory: '../packages/components'` (+ `files`, `titlePrefix`) — fits cataloging **owned** `packages/ui` (and optionally app block components). ([Configure Storybook](https://storybook.js.org/docs/configure))
- Publish: `build-storybook` → static app (default output often `storybook-static`); any host can serve it; Chromatic is recommended for richer review; other hosts are CPP level 0 (serve only). ([Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook); [React Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite))
- shadcn’s documented AI install/discovery path is **registry + CLI + MCP + skills**, not Storybook. ([Your project is ready](https://ui.shadcn.com/docs/new); [MCP](https://ui.shadcn.com/docs/mcp))

**Practical split:** Registry = external menu of standards to pull. Storybook = living inventory of OpenPath’s post-`add` / customized blocks and primitives.

---

## 6. Neutral implications for “compose from standards, invent only gaps”

Grounded in primary sources (not product advice):

1. **Standards exist above the Button.** Official blocks and `registry:block` / `registry:page` cover dashboards, sidebars, auth layouts, etc.; inventing those from scratch duplicates first-party/community registry items. ([Blocks](https://ui.shadcn.com/blocks), [registry-item.json](https://ui.shadcn.com/docs/registry/registry-item-json))
2. **Pull path is agent-operable.** Search → view → add (CLI or MCP) is the documented workflow for finding existing blocks before writing new UI. ([CLI](https://ui.shadcn.com/docs/cli), [MCP](https://ui.shadcn.com/docs/mcp))
3. **After add, code is yours.** Composition and customization happen in-repo; “gaps” are new product-specific surfaces or domain widgets not covered by registries — then optionally republished via your own registry. ([Introduction](https://ui.shadcn.com/docs), [Registry](https://ui.shadcn.com/docs/registry))
4. **Monorepo routing already separates reusable vs app-composed.** Prefer not to fight CLI placement (primitives in `packages/ui`, block shells in app) unless OpenPath deliberately redefines aliases/targets. ([Monorepo](https://ui.shadcn.com/docs/monorepo))
5. **Storybook does not replace the registry for AI.** Use Storybook so humans/agents can *see what OpenPath already owns*; use MCP/CLI to *acquire* missing standards. ([Configure](https://storybook.js.org/docs/configure), [MCP](https://ui.shadcn.com/docs/mcp))
6. **Consistency cost is real.** Dual `components.json`, aligned style/theme, CSS-variable theming, and Tailwind source scanning are prerequisites for blocks to land cleanly and look coherent. ([Monorepo](https://ui.shadcn.com/docs/monorepo), [Theming](https://ui.shadcn.com/docs/theming), [Tailwind detecting classes](https://tailwindcss.com/docs/detecting-classes-in-source-files))

---

## Implications for OpenPath

- Treat **`packages/ui` as the owned primitive library** (CLI-filled, Storybook-documented) and **`apps/web` as the composition surface** for page blocks — matching official monorepo install routing.
- Wire **shadcn MCP + skills + CLI search** so agents default to “find/add block” before inventing layouts; keep Storybook as the **canonical catalog of installed/customized UI**, not the install source.
- Prefer **CSS-variable theming / presets** for brand look so pulled blocks inherit OpenPath tokens without forking every block’s class list.
- Invent **only domain-specific or missing sections**; when a pattern becomes reusable across apps, consider promoting it to an internal namespaced registry (`shadcn build` + `registries` in `components.json`) rather than one-off copies.
- Expect **copy ownership**: customize freely, but plan for upgrade/diff discipline (CLI `--diff` / overwrite) instead of npm library bumps.
- Ensure Tailwind v4 **`@source`** (if needed) covers `packages/ui` so AI-added Tailwind classes in shared packages actually emit CSS.

---

## Sources

| Claim area | URL |
| --- | --- |
| Blocks gallery | https://ui.shadcn.com/blocks |
| Introduction / open code / AI-Ready | https://ui.shadcn.com/docs |
| Your project is ready (blocks, skills, MCP, AI prompts) | https://ui.shadcn.com/docs/new |
| Monorepo install paths | https://ui.shadcn.com/docs/monorepo |
| CLI | https://ui.shadcn.com/docs/cli |
| MCP | https://ui.shadcn.com/docs/mcp |
| Registry MCP (authors) | https://ui.shadcn.com/docs/registry/mcp |
| Registry intro | https://ui.shadcn.com/docs/registry |
| Registry getting started | https://ui.shadcn.com/docs/registry/getting-started |
| registry-item schema docs | https://ui.shadcn.com/docs/registry/registry-item-json |
| registry-item JSON Schema | https://ui.shadcn.com/schema/registry-item.json |
| Registry examples (`registry:block`) | https://ui.shadcn.com/docs/registry/examples |
| components.json / registries | https://ui.shadcn.com/docs/components-json |
| Theming | https://ui.shadcn.com/docs/theming |
| CLI 3.0 / MCP changelog | https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp |
| Example block JSON | https://ui.shadcn.com/r/login-03.json , https://ui.shadcn.com/r/dashboard-01.json |
| shadcn-ui/ui README | https://raw.githubusercontent.com/shadcn-ui/ui/main/README.md |
| Storybook configure (monorepo stories) | https://storybook.js.org/docs/configure |
| Storybook React + Vite | https://storybook.js.org/docs/get-started/frameworks/react-vite |
| Storybook publish | https://storybook.js.org/docs/sharing/publish-storybook |
| Tailwind class detection / monorepo `@source` | https://tailwindcss.com/docs/detecting-classes-in-source-files |
