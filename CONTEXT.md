# Codebase

One npm package. TanStack Start in `src/`. The Coach runs as an eve process in `agent/`. Postgres for accounts and AppState. Not Next.js.

A click and a Coach turn both call `dispatch` in `src/lib/actions/store.tsx`. The Coach never writes the database. It returns an envelope; the browser applies it. Placement rules: [`docs/map.md`](docs/map.md). Stack: [`docs/stack.md`](docs/stack.md).

## Tree

```
src/routes/                 file routes (a file is a URL)
  _signed-in/               sidebar + Coach dock; URLs stay /paper, /coach, …
  _public/                  /p/:slug (one Proof), /u/:handle (personal link)
  api/                      server handlers
src/components/<name>/      UI shared by two routes
src/components/ui/          primitives
src/lib/actions/            AppState, registry, store
src/lib/<noun>/             domain for that noun
src/styles/globals.css      tokens (see DESIGN.md)
agent/                      Coach runtime (eve); one tool, apply_action
scripts/                    dev, db, Railway start
public/                     URL-only assets
```

How to read a route file: `_` is a pathless layout, `-` is not a URL, `$` is a param. Fat screens are a folder plus `-` files (`src/routes/_signed-in/paper/-drive.tsx` is not `/paper/drive`).

## Write path

1. UI calls `dispatch` (`src/lib/actions/store.tsx`).
2. `agent/tools/apply_action.ts` validates and returns `{ ok, action, input, summary }`.
3. `src/components/coach/thread.tsx` applies that envelope with the same `dispatch`.
4. `applyAction` in `src/lib/actions/registry.ts` runs, toasts, offers undo, persists.

Action tables live next to the noun (`src/lib/paper/actions.ts`). The registry spreads them. Query and TanStack DB are reads. Writes still `dispatch`.

```
src/lib/actions/
  registry.ts     every change, one definition each
  store.tsx       the one way state changes
  context.ts      what the Coach may see, sent every turn
  persistence.ts  AppState on the server
  types.ts        the shape the Coach may see and change
  seed.ts         new account: empty
  fixture.ts      tests: populated by dispatching
```

## Features in this tree

Five features plus Coach. Each has one URL, one AppState field, one action prefix. Search stores `openings`. Application stays at `/applications`.

| Noun | URL | Domain | Screen | AppState | Actions |
|---|---|---|---|---|---|
| Profile | `/profile` | `src/lib/profile/` | `routes/_signed-in/profile.tsx`, `components/profile/` | `profile` | `profile.*`, `document.*` |
| Paper | `/paper`, `/paper?id=` | `src/lib/paper/` | `routes/_signed-in/paper/`, `components/paper/` | `paper`, `uploads` | `paper.*` |
| Pitch | `/pitch` | `src/lib/pitch/` | `routes/_signed-in/pitch.tsx` | `pitch` | `pitch.*` |
| Search | `/search` | `src/lib/search/` | `routes/_signed-in/search/` | `openings` | `opening.*` |
| Application | `/applications` | `src/lib/applications/` | `routes/_signed-in/applications/` | `applications` | `application.*` |
| Coach | `/coach` + dock | `src/lib/coach/` | `routes/_signed-in/coach.tsx`, `components/coach/` | conversation, not AppState | none |

Pitch and Search have no `components/` folder. Do not add empty ones. Paper locks (types, Drive, Proof URLs) live in [`docs/paper.md`](docs/paper.md) only.

`src/lib/catalogue/` is shared role archetypes. No Catalogue screen. Ids: `src/lib/ids.ts`.

Also in the tree: Discover (`/`), onboarding, sign-in / sign-up, Help, Settings (plan and billing), `src/routes/dev/` (chat scenarios, traces).

## Coach runtime (eve)

eve is the process that runs the Coach. It is not a product noun and not a second app the person sees. `/coach` and the dock talk to `/eve/*`; Nitro proxies that to this process.

```
agent/
  agent.ts                 defineAgent: model and session limits
  instructions.md          who the Coach is
  channels/eve.ts          who may reach it
  tools/apply_action.ts    validates; the tab applies
```

`npm run dev` starts Vite and eve together. Production is a private Railway service (`openpath-agent`). Without `OPENROUTER_API_KEY`, Coach replies 503. The rest of the app still runs. See [`docs/hosting.md`](docs/hosting.md).

## What is true now

- Node 24 (`.nvmrc`). Node 22 cannot strip TypeScript types.
- Auth is username + password. No email verify, no social, no password recovery.
- An account starts empty. No seeded persona. Onboarding writes the profile.
- Query layer is `pg` and numbered SQL in `src/lib/db/migrations/`. Not Drizzle.
- No n8n. Jobs: `scripts/cron-once.mjs` and `GET /api/cron`.
- No `@ai-sdk/react`. Coach UI talks to eve.
- Host is Railway, not Vercel. `@vercel/og` is only `/p/:slug/og`.

## Docs

| File | Job |
|---|---|
| [`README.md`](README.md) | Run the app |
| [`docs/README.md`](docs/README.md) | Index |
| [`docs/map.md`](docs/map.md) | Where a file goes |
| [`docs/stack.md`](docs/stack.md) | Tech lookup |
| [`docs/database.md`](docs/database.md) | Migrations |
| [`docs/hosting.md`](docs/hosting.md) | Railway |
| [`docs/paper.md`](docs/paper.md) | Paper feature only |
| [`DESIGN.md`](DESIGN.md) | Visual tokens ([design.md](https://github.com/google-labs-code/design.md) format) |
| [`PRODUCT.md`](PRODUCT.md) | Who it is for |
