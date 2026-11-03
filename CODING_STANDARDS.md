# Coding standards

Each rule sits with its reason and the check that enforces it. Every guard, with what it holds, is listed by `node scripts/list-checks.mjs` (generated, never committed). A `pending` or `PENDING` entry (issue or PR, expiry) lists a known offender; a stale entry fails its test.

## Boundaries

Reason: a module's surface stays small, so a change has one place to land.

- Import another api module only through its `index.ts`. Check: `apps/api/src/registry/boundaries.test.ts`.
- Write a table only from the owning module's directory (`auth.ts` owns the auth tables). Check: `apps/api/src/registry/ownership.test.ts`, which holds the owner list.
- Reach the api, `fetch` and query invalidation only from `apps/web/src/lib`. Check: `apps/web/src/test/request-boundary.test.ts`.
- Import between `apps/web/src/features` folders only along an edge its `FEATURE_IMPORTS` table lists. A folder with no row, a row for a gone folder and an edge no import uses fail too. Check: `apps/web/src/test/feature-imports.test.ts`.
- Keep `packages/domain/src` pure TypeScript and zod: no database, server or AI SDK import. `apps/api/src/coach` is the only importer of the AI SDK.
- Export from `packages/domain/src` only what another non-test file imports; drop `export` or delete the rest. Check: `scripts/unused-domain-exports.test.mjs` (`KEPT_ON_PURPOSE` lists the exceptions).
- Where files live: `docs/agents/code-map.md`.

## Contract

Reason: one typed contract per surface gives the Coach tool, step label, activity line, Undo and screen refresh from a single entry. The recipe and the decision are `docs/adr/0010-one-typed-contract-for-commands-and-reads.md`.

- Add a product action as a contract entry in `packages/domain/src/<surface>-contract.ts` (with `invalidates`), a binding in `apps/api/src/<surface>/commands.ts`, a case in `apps/api/src/registry/coverage-<surface>.ts`, and a web call through `runContractCommand`. A per-call option where a contract field fits is a review finding.
- Checks: `apps/api/src/registry/names.test.ts` (a name the registry lacks), `apps/api/src/registry/coverage.test.ts` (a command with no case), the `*-contract.test.ts` files and `apps/api/src/registry/contract.type-test.ts` (a binding that drifts), `apps/api/src/registry/coach-chat-tools.test.ts` (the Coach never gets `chat.create`).

## Comments

Explain with a better name or a test; write no comment. Reason: a comment goes stale where a name or test cannot. Check: `scripts/no-comments.test.mjs` rejects a comment in source, CSS included. No comments; use names or tests.

## Naming

Say Chat or Job. Thread and Opportunity are retired words (Inbox mail threads are the allowed exception). Check: `scripts/retired-words.test.mjs` over source and file names under `apps/*/src` and `packages/*/src`. The old project name, in any case, is refused everywhere except `docs/adr/`.

## Docs

Cite only repo paths and ADRs that exist. Check: `scripts/doc-paths.test.mjs` (backticked paths in `AGENTS.md`, `CONTEXT.md`, `CODING_STANDARDS.md`, `docs/`, `.claude/skills/`; and in each `.claude/skills/**/SKILL.md`, the script paths and `pnpm` scripts it names) and `scripts/adr-citations.test.mjs`.

## Design

Reach for the kit first. Detail, install steps and pen parity: `docs/agents/design-parity.md`.

- Import from `@workspace/ui/components/<name>` and prefer kit components over raw `<button>`, `<input>`, `<textarea>` and `<select>`.
- Use shadcn CSS variables and stock Tailwind sizes; write no raw hex or named palette class (`bg-red-500`) outside the CV print paper. Motion reads the two token pairs in `globals.css`. Check: `apps/web/src/test/design-vocabulary.test.ts`.
- Keep the kit's shape (`base-nova`, one `packages/ui` package the web consumes). Check: `apps/web/src/test/ui-kit-contract.test.ts`.
- Give a tool screen the kit `PageHeader`. Check: `apps/web/src/test/page-header-guard.test.ts`.

## Kit pieces

Use kit `CopyButton`, `Spinner` and `Breadcrumb`. Check: `scripts/kit-duplicates.test.mjs` rejects `clipboard.writeText` or `execCommand("copy")` outside `packages/ui/src/components/copy-button.tsx`, `animate-spin` in `apps/*` and a hand-built breadcrumb.

## State

Keep component state in `useReducer` or `useEffectReducer`. Check: `apps/web/src/test/no-use-state.test.ts`.

## Hover, focus and pointer

- Open on hover through kit `Popover openOnHover` or `useHoverIntent`, never `onMouseEnter` or `onPointerEnter`.
- Hide a region with `FocusSafeRegion`, never `inert={...}`.
- Move things with `width` or `transform`, never `style.setProperty("--x")`.
- Bind keys with `useShortcut` (`apps/web/src/lib/use-shortcut.ts`, which ignores typing, held keys and a pointer drag), never a `window` or `document` key listener.
- Keep a visible focus state: no `box-shadow` or `outline` on a button, link or field without a `:focus-visible` rule in a `*.pen.css`, and no `hover:bg-transparent` or `focus-visible:ring-0` under `features/app-shell`. Check: `scripts/focus-indication.test.mjs`.
- Pair `setPointerCapture` with `pointercancel` and `lostpointercapture` handlers. Check: `scripts/pointer-capture.test.mjs`.
- Give a Button or hover-styled class under `features/app-shell` a 44px phone height (`h-11 md:h-7`). Check: `scripts/touch-targets.test.mjs`.
- Pair `aria-controls` with `aria-expanded`, and give an app-shell dock button both. Check: `apps/web/src/test/disclosure-buttons.test.ts`.
- Check for the first four: the web lint rules, run on the mistake and on correct code by `scripts/web-lint-rules.test.mjs`.

## Navigation

Make each router route current under exactly one nav item, with a count in the link name. Check: `apps/web/src/test/nav-contract.test.tsx`; `nav-pending.json` lists known offenders and `scripts/nav-pending.test.mjs` fails a stale one.

## Commands in the web

Show an error for every rejected command. Check: `apps/web/src/test/rejected-command.test.ts`.

## Paper autosave

Save the parts of a document, not the markdown alone: that would erase a letter's sender, date and closing. Check: `scripts/paper-save-keeps-parts.test.mjs`.

## Browser scripts

Start a browser only through `scripts/lib/chrome-process.mjs`. Check: `scripts/browser-launcher.test.mjs`. A verify driver that calls `comparePenLayout` reads its `mismatches`. Check: `scripts/layout-comparison-gates.test.mjs`.

## Tests

- Assert behavior a person sees and does (text, roles, outcomes), not markup structure.
- Anchor web fixtures to `TEST_NOW` in `apps/web/src/test/test-clock.ts`, never the real date. Check: `scripts/web-test-clock.test.mjs`.
- Inject `timers` in a node test and wait on a fake clock, never the real one. Check: `packages/guards/wall-clock.test.mjs`.
- Warm every lazy route module `apps/web/src/router.tsx` names (marketing pages excepted) in `apps/web/src/test/warm-routes.ts`, or a first test that mounts the app times out against the 5 s `findBy` limit. Check: `apps/web/src/test/warm-routes.test.ts`.
- Run local checks serially; `scripts/check.mjs` caps workers at 2.
