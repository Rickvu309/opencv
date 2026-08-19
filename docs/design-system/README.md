# Design system

The visual law of OpenPath, in four files. [design.md](../design.md) stays at the repo root as the standard-format file agents and tools read first; this folder is where the full system lives. Words are not here: every string a user reads passes [copy.md](../copy.md).

The look is **black and white**: Linear's surface ladder and type, onyx.app's black primary. One near-neutral surface ladder, one black accent that only ever means "interactive", a single variable font at machined weights, hairline borders instead of shadows, dense calm rows. Light theme only for now; every token carries a semantic, dark-ready name so dark mode is a value swap later, not a rename.

## Reading order

1. **[tokens.md](tokens.md)** — the named values: color ladders, type, spacing, radius, elevation, z, interaction states. Source of truth for every visual decision. Ends with the Opal token bridge and the completed swap table from the old `globals.css` aliases.
2. **[clone-sources.md](clone-sources.md)** — where to copy commodity chrome from (Onyx Opal, assistant-ui, Beautiful UI, Open WebUI patterns) before inventing. Port Opal; do not install it.
3. **[layout.md](layout.md)** — the logic of space: the four layers, nine layout types, per-screen regions, reading order, the empty-states law.
4. **[motion.md](motion.md)** — when and how things move: two durations, one easing family, the surface inventory, the never list, reduced motion.
5. **[components.md](components.md)** — the template craft: one block per reusable piece with anatomy, variants, states, internal spacing, and copy hooks. Screens are assembled from these blocks.

The galleries that make this reviewable are two local Storybooks: Opath (Production) at `npm run storybook:production` (port 6006) and Opath (Lab) at `npm run storybook:lab` (port 6007). `npm run storybook` starts both. Hosted: Production at https://opath-production.up.railway.app, Lab at https://opath-lab.up.railway.app — see [hosting.md](../hosting.md). If a surface takes props, it gets a story.

## Two workstreams, one repo

Do not split a second git remote. Lab lives in [`packages/opath-ui`](../../packages/opath-ui) so Lab and Production can move in parallel ([ADR 0007](../adr/0007-opath-ui-in-repo.md)).

| Workstream | Owns | Leaves alone |
|---|---|---|
| Opath (Lab) | `packages/opath-ui/**`, this folder, Lab Storybook | `src/features/**`, `src/core/**`, routes |
| Opath (Production) | features, core, routes, Coach chrome | primitive internals. Compose `@/ui/*`. Missing primitive: spec it here, land it in the package |

Shared seam: tokens in `src/styles/globals.css`, words in [copy.md](../copy.md). Production root primitives and Lab `kit/` counterparts share those tokens and the same focus contract (`:focus-visible` → `--focus-ring`). Lab sourced templates stay generic catalog; they are not product screens.

## The contract

- **design.md** (root) is the standard file: a summary plus frontmatter tokens, kept in lockstep with `src/styles/globals.css` and [tokens.md](tokens.md). Values are live, not a pending pass.
- **copy.md** owns every word. Component blocks name their copy hooks; the words that fill them live in copy.md and the feature specs.
- **flows.md** and **features/navigation.md** own where you can go; layout.md here owns what sits where once you arrive.
- A screen is assembled from the templates in components.md. Inventing a new visual pattern starts with a block in that file — written before the code, same as mechanisms.

## Reference library

Proven sources this system copies from or leans on. When a block cites one, the citation is the spec.

| Reference | What it is for |
|---|---|
| [onyx.app](https://onyx.app/) | Public landing anatomy (sticky nav, hero composer, compact bar, how-it-works). Clone structure; never copy their copy, stats, or assets. [landing.md](../features/landing.md) |
| [Onyx Opal Storybook](https://onyx-storybook.vercel.app/) | Primary commodity design system. Port anatomy from [onyx-dot-app/onyx](https://github.com/onyx-dot-app/onyx) (`web/lib/opal`, `craft/*`). MIT except `ee/`. [ADR 0006](../adr/0006-port-opal.md) |
| [Beautiful UI](https://www.beautifului.dev/) | AI chrome polish: rail, composer, thinking, tool chips, approvals. Map: [clone-sources.md](clone-sources.md) |
| [assistant-ui](https://github.com/assistant-ui/assistant-ui) | ChatGPT-grade Thread / ThreadList / Composer / reasoning-panel / tool-call behaviour. Copy the UX; do not install the runtime. [Docs](https://www.assistant-ui.com/docs/ui/thread) |
| [Open WebUI](https://github.com/open-webui/open-webui) | Patterns only (history groups, message actions, queued messages). Never copy source. |
| [Local photo refs](refs/README.md) | Saved jpgs. Open these instead of fetching Mobbin again. |
| [interfaces.dev/cheat-sheet](https://interfaces.dev/cheat-sheet) | House rules for UI, animation, typography, color naming, and accessibility, adopted wholesale |
| [umbra.nick.qa/tips/content-alignment](https://umbra.nick.qa/tips/content-alignment) | The one-content-inset law in layout.md |
| [animations.dev/vocabulary](https://animations.dev/vocabulary) | The names motion.md uses for every pattern |
| [interactionkit.org](https://interactionkit.org/) | Reference implementations for micro-interactions we adopt |
| [aicss.dev ai-agent-input](https://www.aicss.dev/components/ai-agent-input) | The Coach composer anatomy and working states |
| [sonner.emilkowal.ski](https://sonner.emilkowal.ski/) | The toast — already installed; components.md specs its configuration |
| [transitions.dev](https://transitions.dev/) | Free CSS transition recipes in Lab Storybook |
| [beUI motion](https://beui.dev/components/motion) | Free animated primitives in Lab Storybook |
| [8StarLabs UI](https://ui.8starlabs.com/docs/components) | MIT niche components in Lab Storybook |
| [Kibo UI](https://www.kibo-ui.com/) | MIT composable components and free blocks in Lab Storybook |
| [blocks.so](https://github.com/ephraimduncan/blocks) | MIT shadcn blocks in Lab Storybook |
