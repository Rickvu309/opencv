# OpenPath

An AI career coach for Vietnamese students and new graduates. English UI. Live at [openpath.up.railway.app](https://openpath.up.railway.app). A push to `main` is the deploy ([`docs/hosting.md`](docs/hosting.md)).

This repo is TanStack Start, not Next.js. How the tree works: [`CONTEXT.md`](CONTEXT.md).

## Run it

Node 24 (`.nvmrc`). Earlier Node cannot strip TypeScript types.

```bash
nvm use
npm install
```

Put `DATABASE_URL` and `SESSION_SECRET` in `.env.local`. Apply the schema, then start the app. Setup: [`docs/database.md`](docs/database.md).

```bash
npm run db:migrate
npm run dev          # http://localhost:3000 (Vite + eve)
```

```bash
npm test
npm run lint
npm run build
```

Without `OPENROUTER_API_KEY`, Coach replies fail (503). Auth, Profile, Paper, and the rest still work.

## What you get

- Real accounts (email + password). No email verify, no social login, no password recovery.
- Work stored per account in Postgres. A new account is empty.
- One write path: a click and a Coach turn both `dispatch`. The Coach returns an envelope; the browser applies it, with undo.
- Five features (Profile, Paper, Pitch, Search, Application) plus Coach. `/coach` and the dock are the same thread.

## Docs

[`docs/README.md`](docs/README.md) is the index. Codebase: [`CONTEXT.md`](CONTEXT.md). Visual system: [`DESIGN.md`](DESIGN.md). Audience: [`PRODUCT.md`](PRODUCT.md).
