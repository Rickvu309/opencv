# OpenPath

A personalised AI career coach for Vietnamese early-career users. The Coach converses and operates the product for the user — building their CV, logging their Proof of work, tracking applications — through the same commands the user clicks, with undo on everything.

The app is implemented in this repo. A push to `main` deploys `web` and `worker` on Railway. Without `OPENROUTER_API_KEY` the Coach shows an offline state and everything else still works.

## Run it

Prereqs: Node 24 (`.nvmrc`), Postgres 13+.

```bash
npm install
cp .env.example .env.local     # fill in the variables below
docker compose up -d           # optional local Postgres
npm run db:migrate
npm run dev                    # web on http://localhost:3000
```

| Variable | What |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | 32+ characters, signs session cookies |
| `OPENROUTER_API_KEY` | Coach and AI features; without it the Coach shows an offline state and the rest works |
| `TEST_DATABASE_URL` | Optional; enables database tests in throwaway schemas |

## Scripts

```bash
npm run dev          # web
npm run worker       # job worker
npm run build        # typecheck, then production build
npm start            # production web (applies migrations first)
npm test             # node --test
npm run db:migrate   # also db:status, db:rollback
```

## Deploy

Push to `main`. Railway rebuilds the `web` and `worker` services from the same image; the web process applies pending migrations before it listens. Details: [docs/hosting.md](docs/hosting.md).

## Where things are

- [AGENTS.md](AGENTS.md) — conventions and recipes
- [docs/architecture.md](docs/architecture.md) — system design
- [docs/features/](docs/features/) — one spec per feature
- [docs/mechanisms/](docs/mechanisms/) — signature mechanisms
- [PRODUCT.md](PRODUCT.md) — who this is for
