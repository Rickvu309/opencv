# Design system

The visual law of OpenPath, in four files. [design.md](../design.md) stays at the repo root as the standard-format file agents and tools read first; this folder is where the full system lives. Words are not here: every string a user reads passes [copy.md](../copy.md).

The look is **copied from Linear** — the product, not the marketing site. One near-neutral surface ladder, one indigo accent that only ever means "interactive", a single variable font at machined weights, hairline borders instead of shadows, dense calm rows. Light theme only for now; every token carries a semantic, dark-ready name so dark mode is a value swap later, not a rename.

## Reading order

1. **[tokens.md](tokens.md)** — the named values: color ladders, type, spacing, radius, elevation, z, interaction states. Source of truth for every visual decision. Ends with the Opal token bridge and the migration table from the current `globals.css`.
2. **[clone-sources.md](clone-sources.md)** — where to copy commodity chrome from (Onyx Opal, assistant-ui, Beautiful UI, Open WebUI patterns) before inventing. Port Opal; do not install it.
3. **[layout.md](layout.md)** — the logic of space: the four layers, nine layout types, per-screen regions, reading order, the empty-states law.
4. **[motion.md](motion.md)** — when and how things move: two durations, one easing family, the surface inventory, the never list, reduced motion.
5. **[components.md](components.md)** — the template craft: one block per reusable piece with anatomy, variants, states, internal spacing, and copy hooks. Screens are assembled from these blocks.

The gallery that makes this reviewable is Storybook (`npm run storybook`). Production Storybook is hosted on Vercel from the same git repo; see [hosting.md](../hosting.md). If a surface takes props, it gets a story.

## The contract

- **design.md** (root) is the standard file: a summary plus frontmatter tokens synced with `src/styles/globals.css`. Until the implementation pass lands, [tokens.md](tokens.md) defines the target values and design.md describes the code as it is.
- **copy.md** owns every word. Component blocks name their copy hooks; the words that fill them live in copy.md and the feature specs.
- **flows.md** and **features/navigation.md** own where you can go; layout.md here owns what sits where once you arrive.
- A screen is assembled from the templates in components.md. Inventing a new visual pattern starts with a block in that file — written before the code, same as mechanisms.

## Reference library

Proven sources this system copies from or leans on. When a block cites one, the citation is the spec.

| Reference | What it is for |
|---|---|
| [Onyx Opal Storybook](https://onyx-storybook.vercel.app/) | Primary commodity design system. Port anatomy from [onyx-dot-app/onyx](https://github.com/onyx-dot-app/onyx) (`web/lib/opal`, `craft/*`). MIT except `ee/`. [ADR 0006](../adr/0006-port-opal.md) |
| [Beautiful UI](https://www.beautifului.dev/) | AI chrome polish: rail, composer, thinking, tool chips, approvals. Map: [clone-sources.md](clone-sources.md) |
| [assistant-ui](https://github.com/assistant-ui/assistant-ui) | ChatGPT-grade Thread / ThreadList / Composer behaviour. Copy the UX; do not install the runtime. [Docs](https://www.assistant-ui.com/docs/ui/thread) |
| [Open WebUI](https://github.com/open-webui/open-webui) | Patterns only (history groups, message actions, queued messages). Never copy source. |
| [Local photo refs](refs/README.md) | Saved jpgs. Open these instead of fetching Mobbin again. |
| [interfaces.dev/cheat-sheet](https://interfaces.dev/cheat-sheet) | House rules for UI, animation, typography, color naming, and accessibility, adopted wholesale |
| [umbra.nick.qa/tips/content-alignment](https://umbra.nick.qa/tips/content-alignment) | The one-content-inset law in layout.md |
| [animations.dev/vocabulary](https://animations.dev/vocabulary) | The names motion.md uses for every pattern |
| [interactionkit.org](https://interactionkit.org/) | Reference implementations for micro-interactions we adopt |
| [aicss.dev ai-agent-input](https://www.aicss.dev/components/ai-agent-input) | The Coach composer anatomy and working states |
| [sonner.emilkowal.ski](https://sonner.emilkowal.ski/) | The toast — already installed; components.md specs its configuration |
