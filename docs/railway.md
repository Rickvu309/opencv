# Railway layout (API + Postgres)

Railway hosts the **API and Postgres only** (ADR-0001). Web and Storybook live
on Vercel — never deploy them to Railway.

## Current shape

Project `openpath` (linked to this repo):

| Environment | Services |
| --- | --- |
| `production` | `api` (from `quanvu309/openpath` @ `main`), `Postgres` |
| `staging` | `api`, `Postgres` (own instance, empty data) |

- The `api` service builds from the repo root; its build/start commands,
  healthcheck path, and watch patterns are defined in `/railway.json` at the
  repo root (the single source of truth — the live service settings match it).
- Health: `GET /health` (also Railway's deployment healthcheck path).
- `DATABASE_URL` is set on `api` as the shared reference
  `${{Postgres.DATABASE_URL}}` in **both** environments, so each environment
  resolves to its own Postgres. No credentials live in git.
- Public API domain: service domain under `*.up.railway.app` (see the
  QVE-84 Linear ticket for the exact production URL).

## Local commands

```bash
railway status                 # linked project + environments
railway logs --service api     # deploy/runtime logs
railway redeploy --service api # re-run the latest deployment
railway variable list --service api -e production --kv   # names + raw values
```

## History: legacy layout reset (QVE-84)

The old layout (`web`, `worker`, `opath-lab`, `opath-production`, plus forked
`qve-*` environments) was removed on 2026-08-21. It never matched ADR-0001 —
do **not** recreate web/worker/Storybook services on Railway. A backup of the
deleted services' environment variables was kept outside the repo at
`~/.openpath-backups/` (it contains an `OPENROUTER_API_KEY`).
