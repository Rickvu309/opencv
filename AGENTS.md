# Working in this codebase

Conventions for anyone — human or agent — writing code here. The full system design is [docs/architecture.md](docs/architecture.md); this page is the rules and the recipes.

## The one paragraph

OpenPath is a personalised AI career coach for Vietnamese early-career users. The Coach converses and operates the product; every other screen is an artifact the conversation produced or reads from. Who it is for and how it must feel: [PRODUCT.md](PRODUCT.md).

## Rules

1. **Clone the commodity, craft the signature.** Standard surfaces copy their named reference. The public landing clones [onyx.app](https://onyx.app/) (anatomy, not their copy). Coach chrome and shared primitives port [Onyx Opal](https://github.com/onyx-dot-app/onyx) (MIT, not `ee/`) — Storybook at [onyx-storybook.vercel.app](https://onyx-storybook.vercel.app/) — then restyle to our tokens. Thread behaviour copies [assistant-ui](https://www.assistant-ui.com/docs/ui/thread); the thinking surface copies the [reasoning panel](https://www.assistant-ui.com/elements/reasoning-panel); tool rows copy the [tool call](https://www.assistant-ui.com/elements/tool-call); polish copies [Beautiful UI](https://www.beautifului.dev/). Map: [docs/design-system/clone-sources.md](docs/design-system/clone-sources.md). Do not install `@onyx-ai/opal` or `@assistant-ui/react`. Open WebUI is a pattern reference only. Signature mechanisms (the Coach's hands, Proof, sharing) each have a deep design doc in [docs/mechanisms/](docs/mechanisms/) that outranks feature specs on intent; a new mechanism starts as a new doc there, written before the code. Do not invent on track A; do not cut corners on track B. If a surface takes props, it gets a Storybook story.
2. **Every write is a command.** No handler, server function, or job writes the database directly. Define a command with `defineCommand` in the feature's `commands.server.ts` and call it through the bus. If it should be Coach-callable, set the `agent` flag and write the description for the model, not for humans.
3. **Reads are queries.** `queries.ts` per feature exports TanStack `createServerFn` RPCs the client can call. Server-only helpers live in `*.server.ts` and are imported from handlers, never from screens.
4. **Shapes live in `model.ts`.** Zod first; types derive from schemas. Other features import from `model.ts` or call commands — never a feature's internals.
5. **Routes contain no logic.** A route file renders a screen from `features/<name>/screens/`. Re-designing UI must never touch models, commands, or queries.
6. **`core/` has no product nouns** and never imports from `features/`. **`packages/opath-ui` has no product nouns** and never imports from `features/` or `core/`.
7. **Specs ship with code.** Behaviour changes update `docs/features/<name>.md` in the same PR. Decisions that cross features get an ADR.
8. **Tests exercise the real write path.** Fixtures are built by executing commands, not by inserting rows.

## Tree

```
src/routes/                thin file routes; _app/ is the signed-in shell, _public/ is /p/:slug and /u/:handle
src/features/<name>/       model.ts, commands.server.ts, queries.ts, screens/, components/, *.server.ts, *.test.ts
src/core/                  db, commands (bus), ai (gateway), auth, notifications, jobs, email, config
src/ui/                    app-wired helpers only (run-command, notification bell). Primitives: packages/opath-ui
packages/opath-ui/         Opath (Lab). Primitives and their stories. No product nouns, no core/ imports
src/styles/globals.css     design tokens (see docs/design.md and docs/design-system/tokens.md)
scripts/                   dev, db, worker entry, railway build/start
docs/                      architecture, data, ai, flows, design, hosting, adr/, design-system/, features/
```

Features: coach, profile, paper, proof, pitch, search, application, onboarding, auth, landing, settings, share.

## Recipes

**Add a command.** Define it in the feature's `commands.server.ts`: name (`noun.verb`), Zod input, description, handler returning `{ result, inverse }`, `agent` flag. Register it. Add a test that executes it through the bus and one that undoes it.

**Add a query.** A function or `createServerFn` in the feature's `queries.ts` (client-callable RPC). Server-only reads go in `*.server.ts` and are imported from handlers. Wire the screen with TanStack Query; invalidate it from the commands that change what it reads.

**Add a primitive.** Land it in `packages/opath-ui` with a Storybook story. Spec the block in [docs/design-system/components.md](docs/design-system/components.md) in the same PR. Product screens import `@/ui/<name>`. Do not add `core/` or `features/` imports inside the package.

**Add a screen.** Route file in `src/routes/` that renders a screen component. Search params are typed with `validateSearch` and Zod. Screens compose primitives; they do not edit `packages/opath-ui` unless the gap is a missing primitive.

**Add a migration.** A numbered pair in `src/core/db/migrations/`: `NNN_name.up.sql` and `NNN_name.down.sql`. Never edit an applied migration; the runner checksums them. Update [docs/data.md](docs/data.md).

**Add a feature.** Copy the module shape, one URL, one table cluster, one command prefix. Write `docs/features/<name>.md` first (job, track, screens, data, commands, empty states, out of scope), then build to it.

**Give the Coach a capability.** Usually nothing: if it is a command with `agent: true`, the tool already exists. For reads, add a read tool in `features/coach/agent/`. Never give the agent a capability the UI does not have.

**Add AI behaviour to a feature.** A function in that feature's `ai.server.ts` calling the gateway with a model role (`chat`, `drafting`, `extraction`, `scoring`, `cheap`). Never name a model outside `core/ai/`.

## Copy and voice

Mentor voice: second person, sentence case, contractions fine, **no exclamation marks**. Encouraging but never flattering; every claim shows its basis; end screens and errors with one next step. English UI for now. Type words users see: CV, Resume, Cover letter, Proof, Apply. Full rules: [docs/copy.md](docs/copy.md); tokens: [docs/design.md](docs/design.md); the full visual law (tokens, layout, motion, components): [docs/design-system/](docs/design-system/README.md).

## Commands you will run

```bash
npm run dev          # web + worker locally
npm test             # node --test; db tests skip without TEST_DATABASE_URL
npm run typecheck    # tsc --noEmit
npm run typecheck:ui # design-system package only
npm run lint         # eslint
npm run db:migrate   # apply pending migrations (also db:status, db:rollback)
npm run storybook            # Opath (Production) :6006 and Opath (Lab) :6007
npm run storybook:production
npm run storybook:lab
```

Deploy is a push to `main`; Railway rebuilds both services ([docs/hosting.md](docs/hosting.md)).

## Cursor Cloud specific instructions

Cloud Agent bootstrap lives in [`.cursor/environment.json`](.cursor/environment.json):

- `install` runs [`scripts/cursor-cloud-install.sh`](scripts/cursor-cloud-install.sh) — nvm from `.nvmrc`, `npm ci`, Postgres packages. It must terminate. Do not start servers or run tests here.
- `start` runs [`scripts/cursor-cloud-start.sh`](scripts/cursor-cloud-start.sh) — start Postgres (Docker Compose when Docker is available, otherwise a local cluster), ensure the `openpath` database, then `npm run db:migrate`.

Those scripts must stay in git. Pointing the environment at missing files fails setup with exit 127.

Storybook hosts: Railway services `storybook-production` and `storybook-lab` (public domains in [docs/hosting.md](docs/hosting.md)). Local: Production `:6006`, Lab `:6007`.
