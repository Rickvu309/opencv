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
  aborts the deploy. See [Migration pipeline](#migration-pipeline).
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
- Coach runtime vars live on `api` in **both** environments — see
  [Coach](#coach). Without `OPENROUTER_API_KEY` the process still boots.

## Coach

The Coach runtime is constructed only when `OPENROUTER_API_KEY` is set on the
`api` service. Missing or blank key: the app boots, `GET /health` stays 200,
and `POST /api/threads/:id/coach` returns 503 `COACH_UNAVAILABLE`. Auth,
Paper, Apply, and Threads reads are untouched. That is the graceful posture
— do not fail the deploy or the healthcheck for a missing key.

| Variable | Required | Default | Notes |
| -------- | -------- | ------- | ----- |
| `OPENROUTER_API_KEY` | Yes, for a live Coach | — | Set on **staging and production**. stdin so the value never hits shell history. |
| `COACH_MODEL` | No | `anthropic/claude-sonnet-4.5` | **Deprecated** single-model fallback when a turn has no mode (ADR-0007). New turns resolve via mode. |
| `COACH_MODEL_FREE` | No | `stealth/ox-alpha` | Free mode OpenRouter id (ADR-0009). OX Alpha is a preview. |
| `COACH_MODEL_LIGHT` | No | `deepseek/deepseek-chat-v3.1` | Light mode OpenRouter id. |
| `COACH_MODEL_MAX` | No | `anthropic/claude-opus-4` | Max mode. For Fable: `anthropic/claude-fable-5` or `~anthropic/claude-fable-latest`. |
| `COACH_DAILY_TURN_LIMIT` | No | `50` | Legacy global daily cap. Used when a mode-specific cap is unset. Non-positive values fall back to 50. |
| `COACH_DAILY_TURN_LIMIT_FREE` | No | `50` | Free-mode daily turn cap. |
| `COACH_DAILY_TURN_LIMIT_LIGHT` | No | `30` | Light-mode daily turn cap. |
| `COACH_DAILY_TURN_LIMIT_MAX` | No | `10` | Max-mode daily turn cap. |
| `COACH_RUNTIME` | No | unset (OpenRouter when the key is present) | `fake` injects the scripted runtime for `curl -N` protocol checks. **Never on production.** |

```bash
# both environments; paste the key via stdin
printf '%s' "$OPENROUTER_API_KEY" | railway variable set OPENROUTER_API_KEY --stdin \
  --project openpath --environment staging --service api
printf '%s' "$OPENROUTER_API_KEY" | railway variable set OPENROUTER_API_KEY --stdin \
  --project openpath --environment production --service api
```

Setting a variable redeploys `api`. After both rollouts are SUCCESS:

```bash
COACH_SMOKE_API=https://api-staging-f689.up.railway.app \
  pnpm --filter api smoke

COACH_SMOKE_API=https://api-production-0876.up.railway.app \
  COACH_SMOKE_MODE=production \
  pnpm --filter api smoke
```

Staging smoke (mode `staging` or `auto` once the key is live) checks that a
long streamed turn survives the Railway proxy: `message-start` flushes
immediately, `X-Accel-Buffering: no`, no gzip on the route, 15s heartbeats
when the turn lasts that long, and abort persists `status=aborted`.
Production mode then asks for advice that cites workspace state and a
Command (`apply.moveCard`) and looks for the receipt.

A legacy backup of deleted Railway services (outside the repo, at
`~/.openpath-backups/`) still holds an older `OPENROUTER_API_KEY` if this
machine has it.

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

## Migration pipeline

Schema changes are reviewable SQL, applied automatically, and never touched by
`GET /health` (ADR-0006).

1. Edit TypeScript tables in `apps/api/src/db/schema.ts` (`pgSchema("openpath_app")`).
2. Generate SQL: `pnpm --filter api run db:generate`. Commit the files under
   `apps/api/drizzle/`. One exception: migration 0000 is hand-edited to
   `CREATE SCHEMA IF NOT EXISTS` and must stay that way — see
   [Production's pre-existing `openpath_app`](#productions-pre-existing-openpath_app-qve-135).
3. CI applies those migrations from scratch on pglite
   (`apps/api/src/db/migrate.test.ts`) on every PR and every push to `main`.
4. Railway `preDeployCommand` runs the compiled script
   (`pnpm --filter api run migrate` → `apps/api/dist/migrate.js`) against that
   environment's Postgres (`DATABASE_URL=${{Postgres.DATABASE_URL}}`). Staging
   and production each have their own instance.
5. A failed migrate exits non-zero and aborts the rollout. The previous
   deployment keeps serving. `GET /health` still serves 200 with no database.

Do **not** put the seed script on `preDeployCommand`. Signup already writes the
starter workspace for new accounts.

### Production's pre-existing `openpath_app` (QVE-135)

Production Postgres is not an empty instance. Its `openpath_app` schema predates
these migrations and still holds 26 tables from the pre-QVE-84 legacy app
(`users`, `profiles`, `conversations`, `openings`, `waitlist`, ...), plus a set
of stray Better Auth tables in `public`. None of those names collide with the
Spec 4 tables, and `drizzle.__drizzle_migrations` was empty, so the committed
migrations apply alongside the legacy tables.

Because that schema already existed, migration 0000 is
`CREATE SCHEMA IF NOT EXISTS` — a bare `CREATE SCHEMA` aborted every production
rollout from 2026-08-25 21:31 UTC+7 onward (Postgres `42P06`), which is why
production served a pre-Spec 4 build while staging was correct. Keep 0000
idempotent; `apps/api/src/db/migrate.test.ts` covers it.

The legacy tables and the stray `public` Better Auth tables are dead weight and
still carry old rows. Dropping them is deliberate destructive work that needs
its own ticket and a backup — do not fold it into a deploy. Until then, a new
migration that names a legacy object would abort the rollout the same way, so
check `openpath_app` for the name first.

## Dev / staging seed

`pnpm --filter api run seed` (or `pnpm --filter api run db:seed` via tsx)
writes the same starter workspace the signup hook creates: one sample CV, a
few Apply cards across Stages, one welcome Thread. Requires `DATABASE_URL` and
`SEED_EMAIL`. If that account does not exist, also set `SEED_PASSWORD`,
`SESSION_SECRET`, and `AUTH_URL`.

```bash
# local (after migrate)
SEED_EMAIL=dev@openpath.app SEED_PASSWORD='correct-horse-battery' \
  SEED_NAME=Dev pnpm --filter api run db:seed

# staging, against that environment's Postgres
railway run -e staging --service api -- pnpm --filter api run seed
```

Idempotent: an account that already has Paper, Apply, or Threads is skipped.
Do not point this at production unless you intend to seed one empty account.

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
`~/.openpath-backups/` (it contains an `OPENROUTER_API_KEY` useful for the
[Coach](#coach) vars if this machine has the backup).
