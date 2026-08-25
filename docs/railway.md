# Railway layout (API + Postgres)

Railway hosts the **API and Postgres only** (ADR-0001). Web and Storybook live
on Vercel — never deploy them to Railway.

## Current shape

Project `openpath` (linked to this repo):

| Environment  | Services                                               |
| ------------ | ------------------------------------------------------ |
| `production` | `api` (from `quanvu309/openpath` @ `main`), `Postgres` |
| `staging`    | `api`, `Postgres` (own instance, empty data)           |

- The `api` service builds from the repo root; its build/start/pre-deploy
  commands, healthcheck path, and watch patterns are defined in `/railway.json`
  at the repo root (the single source of truth — the live service settings
  match it). `buildCommand` uses `--filter api...` so workspace dependencies
  compile with the api. `preDeployCommand` runs the compiled migrate script
  (`pnpm --filter api run migrate`) before each rollout; a migration failure
  aborts the deploy.
- Health: `GET /health` (also Railway's deployment healthcheck path). The
  route never touches Postgres, so it serves 200 with no `DATABASE_URL`.
- `DATABASE_URL` is set on `api` as the shared reference
  `${{Postgres.DATABASE_URL}}` in **both** environments, so each environment
  resolves to its own Postgres. No credentials live in git.
- `SESSION_SECRET` and `AUTH_URL` are set on `api` in **both** environments
  (distinct secrets). `AUTH_URL` is the public API origin — staging
  `https://api-staging-f689.up.railway.app`, production
  `https://api-production-0876.up.railway.app` — and selects cookie attributes
  (`SameSite=None; Secure` when https).
- Public API domains: `api-production-0876.up.railway.app` (production) and
  `api-staging-f689.up.railway.app` (staging).

## Cross-host access (CORS)

The web app runs on Vercel, so every call to the API is cross-origin. `api`
reads `WEB_ORIGINS` — a comma-separated allowlist — and echoes back only origins
that match. An entry may contain one `*`, which matches a single DNS label, so
`https://openpath-*-rickvudev.vercel.app` covers Vercel's per-deployment preview
subdomains without opening the API to every host under `vercel.app`.

| Environment  | `WEB_ORIGINS`                                                   |
| ------------ | --------------------------------------------------------------- |
| `production` | `https://openpath-app.vercel.app`                               |
| `staging`    | `https://openpath-*-rickvudev.vercel.app,http://localhost:5173` |

Production stays pinned to the production alias. The previous auto alias
`https://openpath-lovat.vercel.app` 308-redirects to that URL, so the browser
calls `/health` from the new origin. A production deployment opened through
its per-deployment URL rather than the alias is therefore blocked by CORS —
use the alias. Unset `WEB_ORIGINS` means local-only (`http://localhost:5173`),
which is what `pnpm dev` needs.

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
