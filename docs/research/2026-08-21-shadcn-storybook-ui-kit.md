# Research: shadcn/ui + Storybook UI kit for OpenPath

**Date:** 2026-08-21  
**Scope:** Primary sources only (official docs, first-party GitHub, specs). No secondary blog roundups.  
**Brainstorm context:** Storybook as catalog host; shadcn-style components in a monorepo `packages/ui`; AI agents build UI faster with plug-and-play standards; web and Storybook on Vercel.

---

## Summary

shadcn/ui is officially **not** a traditional npm component library: the CLI **copies component source into your repo** so you own and customize the code. Official monorepo support scaffolds `apps/web` + `packages/ui`, installs UI primitives into the shared package, and has apps import via a workspace package (e.g. `@workspace/ui`). That pattern matches an internal `packages/ui` consumed by `apps/web` without publishing a black-box npm library.

Storybook officially supports **React + Vite** (`@storybook/react-vite`), can load stories from monorepo package directories, builds a **static** site (`storybook-static` by default) serveable by any host, and documents monorepo Autodocs caveats. Vercel lists Storybook as a **Framework Preset** and documents static/other hosting patterns.

For AI-speed goals, shadcn’s own docs emphasize open source in-repo, CLI `add`/`search`/`docs`, MCP, and skills — discoverability via Storybook is complementary but not specified by shadcn as the primary AI surface.

---

## Findings

### Official shadcn/ui model: copy-into-repo vs npm package

- shadcn/ui states: **“This is not a component library. It is how you build your component library.”** Traditional flow (install npm package → import) is contrasted with handing you the actual component code. ([Introduction](https://ui.shadcn.com/docs))
- Design principles include **Open Code**, **Distribution** (flat-file schema + CLI), and **AI-Ready** (open code for LLMs to read/understand/improve). ([Introduction](https://ui.shadcn.com/docs))
- After project creation: “Unlike traditional component libraries, shadcn/ui **adds the component source code directly to your project** under `components/ui/`. You own the code…” ([Your project is ready](https://ui.shadcn.com/docs/new))
- First-party GitHub README: “Use this to **build your own component library**.” Docs live at ui.shadcn.com. ([shadcn-ui/ui README](https://raw.githubusercontent.com/shadcn-ui/ui/main/README.md))
- `components.json` is optional if you only copy/paste; it is **required when using the CLI** to add components. ([components.json](https://ui.shadcn.com/docs/components-json))
- CLI `add` writes components (and deps) into the project; options include `--all`, `--cwd`, `--path`, `--dry-run`. ([CLI](https://ui.shadcn.com/docs/cli))

### Recommended monorepo / shared package setup

- Official monorepo: `init --monorepo` creates workspaces **`web` and `ui`**, with Turborepo. ([Monorepo](https://ui.shadcn.com/docs/monorepo))
- File layout: `apps/web` (app) and `packages/ui` (components, hooks, lib, `styles/globals.css`). ([Monorepo](https://ui.shadcn.com/docs/monorepo))
- `add` from the app path: UI primitives (e.g. `button`) install under **`packages/ui`**; app-level blocks (e.g. `login-01`) may install under `apps/web/components`, with deps routed correctly. ([Monorepo](https://ui.shadcn.com/docs/monorepo))
- App imports: `import { Button } from "@workspace/ui/components/button"` (also hooks/utils from `@workspace/ui/...`). ([Monorepo](https://ui.shadcn.com/docs/monorepo))
- **Every workspace** that uses the CLI needs its own `components.json` with aligned `style`, `iconLibrary`, and `baseColor`. ([Monorepo](https://ui.shadcn.com/docs/monorepo))
- For Tailwind CSS **v4**, leave `tailwind.config` **empty** in `components.json`. App `components.json` can point `tailwind.css` at `../../packages/ui/src/styles/globals.css`. ([Monorepo](https://ui.shadcn.com/docs/monorepo), [components.json](https://ui.shadcn.com/docs/components-json))
- Vite path: `init -t vite --monorepo`; add with `-c apps/web`; monorepo apps import from `@workspace/ui/components/...`. ([Vite installation](https://ui.shadcn.com/docs/installation/vite))

### Can shadcn components live in internal `packages/ui` and be consumed by `apps/web`?

- **Yes — this is the official monorepo pattern.** Shared UI is a workspace package (`@workspace/ui`) with `dependencies: { "@workspace/ui": "workspace:*" }` on the app. ([Monorepo](https://ui.shadcn.com/docs/monorepo), [Package imports](https://ui.shadcn.com/docs/package-imports))
- Official examples mark the UI package **`"private": true`** and expose paths via **`package.json` `exports`** (e.g. `./components/*`, `./lib/*`, `./hooks/*`, `./globals.css`). ([Package imports](https://ui.shadcn.com/docs/package-imports))
- Constraint: the shared package **must export any path** referenced across workspaces; local `#...` imports stay package-local; cross-workspace uses `@workspace/ui/...`. ([Monorepo](https://ui.shadcn.com/docs/monorepo))
- This is still the **source-in-repo / CLI-add** model inside `packages/ui`, not “install opaque shadcn components from the public npm registry as a library.” Consumption is via workspace package imports of that source. ([Introduction](https://ui.shadcn.com/docs), [Monorepo](https://ui.shadcn.com/docs/monorepo))

### Official Storybook: React + Vite, component library / monorepo

- Framework: **Storybook for React & Vite** via `@storybook/react-vite`; install with `create storybook@latest`; `storybook` / `build-storybook` scripts; default output dir **`storybook-static`**. ([React Vite framework](https://storybook.js.org/docs/get-started/frameworks/react-vite))
- Story locations are configured in `.storybook/main.ts` via globs or **directory objects**; docs explicitly show loading from **`../packages/components`** with `files` and `titlePrefix` — the monorepo / shared-library pattern. ([Configure Storybook](https://storybook.js.org/docs/configure))
- Default intent: **colocate** `*.stories.*` with components. ([Configure Storybook](https://storybook.js.org/docs/configure))
- Autodocs monorepo troubleshooting: import components **directly** (not only via package barrel/index); for TypeScript, set `typescript.reactDocgen` to `'react-docgen'` and `check: false` so multi-package docs generate. ([Autodocs](https://storybook.js.org/docs/writing-docs/autodocs))
- Composition (`refs`) can embed other published Storybooks by URL — useful if multiple catalogs exist. ([Configure Storybook](https://storybook.js.org/docs/configure) `refs` field; [Storybook Composition](https://storybook.js.org/docs/sharing/storybook-composition))

### Deploying Storybook statically (Vercel-relevant)

- Official publish flow: run **`build-storybook`**; result is a **static web app** “capable of being served by **any web server**”; preview with `http-server` on the build path. ([Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook))
- Storybook documents publishing to Chromatic and **other hosts** (GitHub Pages, Netlify, S3, etc.). Hosts without Storybook API integration are **CPP level 0** (serve static only). ([Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook))
- Default build artifact directory: **`storybook-static`**. ([React Vite framework](https://storybook.js.org/docs/get-started/frameworks/react-vite); [Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook) GitHub Pages example `path: 'storybook-static'`)
- Storybook’s test-runner docs mention publishing with services such as **Vercel or Netlify** (deployment status URLs). ([Test runner](https://storybook.js.org/docs/writing-tests/integrations/test-runner))
- Vercel lists **Storybook** as a Framework Preset (“Frontend workshop for UI development”) with a cloneable example repo under Vercel’s examples. ([Configure a Build](https://vercel.com/docs/builds/configure-a-build); [More frameworks](https://vercel.com/docs/frameworks/more-frameworks))
- Vercel also documents generic static hosting: Framework Preset **Other**, empty/override build when no build is needed, or set build command + output directory for static output. ([Configure a Build](https://vercel.com/docs/builds/configure-a-build))

### Tailwind + shadcn in a shared package (CSS / config sharing)

- Monorepo docs: shared styles live under `packages/ui/src/styles/globals.css`; app `components.json` can reference that CSS path; both workspaces share `style` / `baseColor` / `iconLibrary`. Tailwind v4: empty `tailwind.config` in `components.json`. ([Monorepo](https://ui.shadcn.com/docs/monorepo))
- Package `exports` include `"./globals.css"` so apps can import shared CSS from `@workspace/ui/globals.css`. ([Package imports](https://ui.shadcn.com/docs/package-imports))
- Theming: CSS variables recommended; tokens live in the global CSS under `:root` / `.dark`; default scaffold uses `@import "tailwindcss"` and `@import "shadcn/tailwind.css"`. ([Theming](https://ui.shadcn.com/docs/theming))
- CLI `eject` inlines `shadcn/tailwind.css`; monorepo note: run from the workspace that owns `components.json` and global CSS, e.g. `-c packages/ui`. ([CLI eject](https://ui.shadcn.com/docs/cli))
- Tailwind CSS v4 official scanning: auto-detects sources but **ignores `node_modules` and `.gitignore` paths**; monorepos may need `@source` for external packages or `source(...)` to set the scan base path when builds run from repo root. ([Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files))

### Pros / constraints for “AI builds UI faster” (official docs only)

**Pros grounded in official docs**

- **Open code in-repo** → LLMs can read/modify components directly; shadcn calls this **AI-Ready** / AI Integration. ([Introduction](https://ui.shadcn.com/docs), [Your project is ready](https://ui.shadcn.com/docs/new))
- **Composable, shared API** across components → “predictable for both your team and LLMs.” ([Introduction](https://ui.shadcn.com/docs))
- **CLI discoverability**: `add`, `search`/`list`, `view`, `docs` (fetch docs/API refs), `info`. ([CLI](https://ui.shadcn.com/docs/cli))
- **MCP server**: browse/search registries and install via natural language; works with Cursor (`.cursor/mcp.json`); private registries supported via `components.json` `registries`. ([MCP Server](https://ui.shadcn.com/docs/mcp))
- **Skills**: `pnpm dlx skills add shadcn/ui` for registry/docs/search access in the assistant. ([Your project is ready](https://ui.shadcn.com/docs/new))
- Example AI prompts officially suggested (signup, settings, dashboard). ([Your project is ready](https://ui.shadcn.com/docs/new))

**Constraints / caveats from official docs**

- Model is **copy/own**, not versioned black-box npm upgrades; upstream updates are a different problem than `npm update` (Introduction discusses open-code tradeoffs). ([Introduction](https://ui.shadcn.com/docs))
- Monorepo requires **dual `components.json`**, export hygiene, and consistent theme settings — misaligned aliases break CLI routing. ([Monorepo](https://ui.shadcn.com/docs/monorepo))
- Storybook Autodocs in monorepos can miss docs unless imports and `reactDocgen` are configured carefully. ([Autodocs](https://storybook.js.org/docs/writing-docs/autodocs))
- Tailwind may not see classes in ignored/workspace paths without `@source` / base path configuration. ([Detecting classes](https://tailwindcss.com/docs/detecting-classes-in-source-files))
- Storybook on generic static hosts (including typical Vercel static serve) is **serve-only** unless using a CPP-integrated host (e.g. Chromatic features). ([Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook))
- shadcn’s documented AI surfaces are **source + CLI + MCP + skills**, not Storybook itself; Storybook remains a human/catalog/review surface per Storybook publish docs. ([MCP](https://ui.shadcn.com/docs/mcp), [Publish Storybook](https://storybook.js.org/docs/sharing/publish-storybook))

---

## Implications for OpenPath brainstorm

Neutral observations only — not a decision.

1. **`packages/ui` + `apps/web` aligns with first-party shadcn monorepo guidance** (workspace package + CLI routing into `packages/ui`), so the brainstorm’s package shape is on the paved path rather than a custom invention.
2. **Treat `packages/ui` as owned source**, not as a published opaque design-system npm package, unless OpenPath deliberately builds a private registry on top of shadcn’s registry schema (`shadcn build` / namespaced registries). Official monorepo examples use `private: true` + `exports`.
3. **Storybook as catalog** fits official Storybook monorepo story loading (`packages/...` directories) and static deploy; Vercel’s Storybook framework preset + static output (`storybook-static`) make dual Vercel projects (app + Storybook) operationally plausible.
4. **For AI plug-and-play**, official leverage is strongest around **in-repo component source, CLI, MCP, and skills**. Storybook improves human discoverability and review; wiring agents to Storybook MDX/stories is not prescribed by shadcn docs.
5. **Shared Tailwind/CSS** should plan for one globals/theme home under `packages/ui`, app import of that CSS, aligned `components.json`, and Tailwind v4 `@source` / scan-base if the monorepo root build misses package classes.
6. **Open questions left open by primary sources:** exact Vercel build command/output defaults for the Storybook preset (example clone linked from Vercel docs; verify at project setup); whether OpenPath wants Chromatic-level features vs static-only Storybook; whether a private shadcn registry is needed beyond a single monorepo.

---

## Sources

| Source | URL |
| --- | --- |
| shadcn/ui Introduction | https://ui.shadcn.com/docs |
| shadcn/ui Your project is ready | https://ui.shadcn.com/docs/new |
| shadcn/ui Monorepo | https://ui.shadcn.com/docs/monorepo |
| shadcn/ui Package imports | https://ui.shadcn.com/docs/package-imports |
| shadcn/ui components.json | https://ui.shadcn.com/docs/components-json |
| shadcn/ui CLI | https://ui.shadcn.com/docs/cli |
| shadcn/ui Vite installation | https://ui.shadcn.com/docs/installation/vite |
| shadcn/ui Theming | https://ui.shadcn.com/docs/theming |
| shadcn/ui MCP Server | https://ui.shadcn.com/docs/mcp |
| shadcn-ui/ui GitHub README | https://raw.githubusercontent.com/shadcn-ui/ui/main/README.md |
| Storybook React + Vite | https://storybook.js.org/docs/get-started/frameworks/react-vite |
| Storybook Configure | https://storybook.js.org/docs/configure |
| Storybook Publish | https://storybook.js.org/docs/sharing/publish-storybook |
| Storybook Autodocs | https://storybook.js.org/docs/writing-docs/autodocs |
| Storybook Composition | https://storybook.js.org/docs/sharing/storybook-composition |
| Storybook Test runner (Vercel mention) | https://storybook.js.org/docs/writing-tests/integrations/test-runner |
| Vercel Configure a Build | https://vercel.com/docs/builds/configure-a-build |
| Vercel More frameworks | https://vercel.com/docs/frameworks/more-frameworks |
| Tailwind CSS Detecting classes | https://tailwindcss.com/docs/detecting-classes-in-source-files |
