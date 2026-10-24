## Keep base-nova on Base UI

**Decision.** Keep `"style": "base-nova"` in `apps/web/components.json` and `packages/ui/components.json`, and keep `@base-ui/react` ^1.9.0. Do not move to a Radix style.

**Why the registries decide it.**

- AI Elements, Trace and Code Block ship a Base UI variant. The changelog says "Trace and Code Block are available for Base UI, React Aria and Radix across all eight styles" (A1), and each pattern page has Base UI, React Aria and Radix tabs (A3).
- Kibo UI imports shadcn primitives by path, not by library. `kanban.json` has `"registryDependencies":["card","scroll-area"]`, `table.json` has `["button","dropdown-menu","table"]`, `contribution-graph.json` has none (A6). The project's style resolves those names, so Base UI works.
- Cult UI is the one registry that picks a primitive library, and it picks Base UI. `halo-tabs.json` declares `"dependencies": ["@base-ui/react"]` and imports `@base-ui/react/tabs`, and `llms.txt` has zero Radix mentions (A7). A Radix base would put both libraries in the bundle the first time a Halo piece lands.
- Magic UI and affectUI import no primitive library. Magic items import `motion/react` and `@/lib/utils` (A8). affectUI items are "one .tsx file with its styles inside, no Tailwind, no animation library, no other dependencies" (A9).

**Trade-offs.**

- For Base UI. No migration of the 18 stock kit files, no second primitive library, Cult Halo pieces drop in, and the CLI supports it as a first-class base (`init -b, --base <base>` accepts `base`, `radix`, `aria`, A2).
- Against Base UI. Older snippets and some registry examples assume Radix `asChild`. Base UI composes with a `render` prop. Every pasted pattern needs an `asChild` scan (DS-2, DS-3 Build). Community answers and blog code skew to Radix, so an owner copying from a non-registry source pays a translation cost.
- For Radix. The larger body of examples. Nothing in the five registries needs it.
- Against Radix. Re-adding 18 kit files changes every interactive element at once, which is a review and regression cost with no registry gain, and Cult Halo pieces would still pull `@base-ui/react`.
