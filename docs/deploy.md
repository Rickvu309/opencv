# Deploying OpenCV on Railway

Railway hosts everything: the `api`, `Postgres` and the static `web` app,
behind the `opencv.me` zone on Cloudflare. There is one environment:
production. Main deploys straight to production; there is no staging and no
per-PR preview deploy yet. Rollback is a Railway redeploy of the previous
deployment (see Rollback). This file is the runbook.

Each service redeploys from `main` when a file under its watch paths changes.
No CI gates a deploy (the repo runs no GitHub Actions), so the local pre-push
check and the review before merge are the gate.

## Layout

Railway project `openpath` (the name predates the rename; renaming it is
cosmetic, then update the name in `.railway/railway.ts`).

| Environment  | Service    | Built from                                  | Public host                                                    |
| ------------ | ---------- | ------------------------------------------- | -------------------------------------------------------------- |
| `production` | `api`      | Nixpacks, repo root                         | `api.opencv.me`, fallback `api-production-0876.up.railway.app` |
| `production` | `web`      | `apps/web/Dockerfile`, repo root as context | `opencv.me`, `www.opencv.me`                                   |
| `production` | `Postgres` | Railway database                            | private network only                                           |

`.railway/railway.ts` declares the intended `api` and `web` build, start,
watch-path and health settings (Railway stops reading `railway.json` on
2026-12-01, so that file is gone). IaC evaluation requires Node >=22, the root
`railway` SDK dependency installed with `pnpm install --frozen-lockfile`, and
Railway CLI >=5.42.1. Preview an edit with
`railway config plan --file .railway/railway.ts --environment production`.
Railway does not automatically apply this file during GitHub deploys.

The stable named partial `opencv-apps` scopes ownership to `api` and `web`.
Existing `Postgres` and `postgres-volume` stay outside that ownership; do not
redeclare them from defaults. Omitted resources are retained only when this
partial does not already own them. Check `railway config partials list --json`
and the structured plan before any apply. Do not rename the partial without
an ownership transfer. See [Railway's ownership rules](https://docs.railway.com/infrastructure-as-code#ownership-rules).

The API retains GitHub source `quanvu309/opencv` on `main`. Its `AUTH_URL`,
`WEB_ORIGINS`, `DATABASE_URL`, `OPENROUTER_API_KEY` and `SESSION_SECRET` are
explicit `preserve()` declarations: values stay in Railway. The file declares
no secret values or domains. The cutover flips `AUTH_URL` and `WEB_ORIGINS`
by hand. The layout above is the target; a plan that creates `web` does not
prove it is deployed.

| Service | Build                                                                                     | Pre-deploy                      | Start                         | Health                       |
| ------- | ----------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------- | ---------------------------- |
| `api`   | `pnpm install --frozen-lockfile && pnpm --filter api... run build`                        | `pnpm --filter api run migrate` | `pnpm --filter api run start` | `GET /health`, 120 s timeout |
| `web`   | Dockerfile: `pnpm install --frozen-lockfile && pnpm turbo build --filter=web`, then Caddy | none                            | `caddy run` (image `CMD`)     | `GET /health`                |

`api` restarts `ON_FAILURE` up to 10 times. `api` watches `apps/api/**`,
`packages/**`, the lockfile, `pnpm-workspace.yaml`, `package.json` and
`turbo.json`. `web` watches `apps/web/**`, `packages/ui/**`,
`packages/domain/**` and `pnpm-lock.yaml`.

## Web

`apps/web/Dockerfile` has two stages. The build stage declares
`ARG VITE_API_URL` and exports it as `ENV` before the build, because Vite bakes
the value into the bundle at build time. A change to `VITE_API_URL` takes
effect on the next deploy of `web`, not on a restart. When it is unset the app
falls back to `http://localhost:3001` (`apps/web/src/lib/api.ts`), which is what
local `pnpm dev` wants. The second stage is `caddy:2-alpine` serving
`apps/web/dist` from `/srv` with `apps/web/Caddyfile`:

- `auto_https off`: Railway terminates TLS.
- Listens on `$PORT`, 8080 when unset.
- `GET /health` answers `ok` with 200.
- Every other path tries the file, then falls back to `/index.html`, because
  TanStack Router routes client-side and a refresh on `/app` must not 404.
- `/assets/*` is `public, max-age=31536000, immutable`; everything else is
  `no-cache`, so a deploy shows up on the next load.

Railway passes a service variable to a Dockerfile build only when the stage
declares it with `ARG`. If a deploy shows the bundle without the
expected URL, the fallback is a runtime `window.__API_URL__` that Caddy injects
from an env var.

Build the same thing locally (no Docker needed):

```bash
VITE_API_URL=https://api.opencv.me pnpm turbo build --filter=web
grep -l "api.opencv.me" apps/web/dist/assets/*.js
pnpm --filter web preview   # serves apps/web/dist
```

`vite preview` falls back to `index.html` on its own, so it does not prove the
Caddy behaviour. `caddy validate --config apps/web/Caddyfile --adapter caddyfile`
does, when `caddy` is installed.

## Variables

Set by hand in Railway, never in git. `DATABASE_URL` is the shared reference
`${{Postgres.DATABASE_URL}}`, which resolves to the `Postgres` service in the
`production` environment.

| Environment  | Service | Variable       | Value                                                                                     |
| ------------ | ------- | -------------- | ----------------------------------------------------------------------------------------- |
| `production` | `api`   | `AUTH_URL`     | `https://api.opencv.me` (set at cutover step 4; before that, the `*.up.railway.app` host) |
| `production` | `api`   | `WEB_ORIGINS`  | `https://opencv.me`, plus any origin of the previous host until the overlap ends          |
| `production` | `web`   | `VITE_API_URL` | `https://api.opencv.me` (from `.railway/railway.ts`)                                      |

`AUTH_URL` is the public api origin and selects the cookie attributes:
`SameSite=None; Secure` when it is https (`apps/api/src/auth.ts`). That stays
until only `opencv.me` calls the api; it can then become `Lax`, as a separate
change.

`WEB_ORIGINS` is a comma-separated allowlist of exact origins with no trailing
slash (a trailing slash never matches). An entry may contain one `*`, which
matches a single DNS label. Unset means local only (`http://localhost:5173`).
The api and web must agree: a new web origin has to be added here, or the
browser blocks the response.

## Coach

The Coach runtime is built only when `OPENROUTER_API_KEY` is set on the `api`
service. Missing or blank key: the app boots, `GET /health` stays 200, and
`POST /api/threads/:id/coach` returns 503 `COACH_UNAVAILABLE`. Auth, Paper,
Apply and Threads reads are untouched. Do not fail the deploy or the healthcheck
for a missing key. The web app only needs `VITE_API_URL`; the Coach vars are
`api` variables.

| Variable                       | Required              | Default                                    | Notes                                                                                       |
| ------------------------------ | --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`           | Yes, for a live Coach | none                                       | Set on production. Pass it on stdin so it never hits shell history.                         |
| `OPENROUTER_BASE_URL`          | No                    | unset (the provider URL)                   | Local checks only: points the Coach at a stub endpoint. **Never on production.**            |
| `COACH_MODEL_FREE`             | No                    | `openrouter/free`                          | Free mode id. Free Models Router. The answering model can change between turns. |
| `COACH_MODEL_LIGHT`            | No                    | `deepseek/deepseek-chat-v3.1`              | Light mode id.                                                                              |
| `COACH_MODEL_MAX`              | No                    | `anthropic/claude-opus-4`                  | Max mode. For Fable: `anthropic/claude-fable-5` or `~anthropic/claude-fable-latest`.        |
| `COACH_DAILY_TURN_LIMIT_FREE`  | No                    | `50`                                       | Free-mode daily turn cap.                                                                   |
| `COACH_DAILY_TURN_LIMIT_LIGHT` | No                    | `30`                                       | Light-mode daily turn cap.                                                                  |
| `COACH_DAILY_TURN_LIMIT_MAX`   | No                    | `10`                                       | Max-mode daily turn cap.                                                                    |
| `COACH_RUNTIME`                | No                    | unset (OpenRouter when the key is present) | `fake` injects the scripted runtime for `curl -N` protocol checks. **Never on production.** |

The defaults in this table are what the api ships today. Release one changes the daily caps to 20, 10 and 5, and routes Pro to Claude. See `docs/adr/0004-plans-and-coach-tiers.md`.

```bash
printf '%s' "$OPENROUTER_API_KEY" | railway variable set OPENROUTER_API_KEY --stdin \
  --project openpath --environment production --service api
```

Setting a variable redeploys `api`. When the rollout is SUCCESS:

```bash
COACH_SMOKE_API=https://api.opencv.me COACH_SMOKE_MODE=production pnpm --filter api smoke
```

Production mode asks for advice that cites workspace state and a Command
(`apply.moveCard`) and looks for the receipt.

## Domains and DNS

Add each domain on its Railway service first; Railway then shows the CNAME
target and a TXT verification record. Both are needed (a missing TXT serves
404). The certificate arrives within about an hour. Zone `opencv.me` is on
Cloudflare with SSL mode **Full** (Railway says Full (Strict) does not work).

| Name        | Type  | Target                            | Proxy mode  | Service           |
| ----------- | ----- | --------------------------------- | ----------- | ----------------- |
| `@`         | CNAME | web production target (flattened) | proxied     | `web` production  |
| `www`       | CNAME | web production target             | proxied     | `web` production  |
| `api`       | CNAME | api production target             | DNS-only    | `api` production  |
| Railway TXT | TXT   | name and value shown per domain   | not proxied | each of the three |

Use single-label names: behind the proxy a deeper name needs Cloudflare's
Advanced Certificate Manager.

`api` stays DNS-only because the Coach streams SSE and a Cloudflare proxy adds
a buffering and timeout layer the smoke has not been run through. To turn the
proxy on, run the production smoke once with it on and keep it only if every
check passes.

## Cutover

The one-time move from the `*.up.railway.app` hosts and the previous web host to `opencv.me`.
Steps 1 to 3 and 5 are reversible by reverting the record or variable. Step 4
is reversible in config, but every signed-in user is signed out once either
way. Do not start without the operator's go.

1. Migrate the config. Review `railway config plan --file .railway/railway.ts --environment production`
   as structured JSON: the intended changes create `web`, set the API builder
   to `NIXPACKS`, build API workspace dependencies with `--filter api...`,
   and add the pre-deploy migration and restart policy. Reject database or
   volume changes, source removal, and existing variable-value changes.
   With operator approval, apply to production; inspect `railway config migrate status`
   before any needed `railway config migrate cutover`. Planning does not
   execute the migration; an approved deployment's pre-deploy command does.
   Finish this **before 2026-12-01**, when `railway.json` stops being read.
2. Add the three domains and the Cloudflare records, then wait for each
   certificate. Check `curl -sI https://api.opencv.me/health`.
3. Add the new origin to `WEB_ORIGINS` and keep the old one, then redeploy `web`
   so it builds with the new `VITE_API_URL`. Confirm the bundle holds
   `api.opencv.me` and that sign-in works on `https://opencv.me`.
4. Flip production `AUTH_URL` to `https://api.opencv.me`. Do this last. Browsers
   hold no cookie for the new host, so every user signs in once more (the
   sessions and data are kept). Announce it first.
5. Keep the `*.up.railway.app` hosts for one to two weeks. Then drop any origin
   of the previous host from `WEB_ORIGINS` and set the GitHub homepage to
   `https://opencv.me`.

## Rollback

One environment: production. Main deploys straight to production, so rollback
is a Railway redeploy of the previous deployment: open the service in Railway
and pick the previous deployment. A failed build or a failed pre-deploy
migration never replaces the running deployment (see Migration pipeline).

To undo the `opencv.me` cutover itself, point `AUTH_URL` back to the
`*.up.railway.app` host (one more forced re-login), remove the new origin from
`WEB_ORIGINS`, and run `railway config migrate undo`. The `opencv.me` zone held
no records before the cutover, so there are no earlier targets to restore:
delete the Cloudflare records, or leave them. Resolvers may cache them for a
while, and the Railway service domains (`*.up.railway.app`) stay reachable
directly until the services are removed.

## Migration pipeline

Schema changes are reviewable SQL, applied automatically, and never touched by
`GET /health`.

1. Edit the TypeScript tables in `apps/api/src/db/schema.ts`. The code on `main`
   still uses `pgSchema("openpath_app")`. Release one adds `opencv_app` in a
   fresh baseline and leaves `openpath_app` in place. See
   `docs/adr/0002-vocabulary-job-chat-stages.md`. No migration deletes data.
2. Generate SQL with `pnpm --filter api run db:generate` and commit the files
   under `apps/api/drizzle/`. Migration 0000 is hand-edited to
   `CREATE SCHEMA IF NOT EXISTS` and must stay that way.
3. `apps/api/src/db/migrate.test.ts` applies the migrations from scratch on pglite.
4. Railway's `preDeployCommand` runs `pnpm --filter api run migrate`
   (`apps/api/dist/migrate.js`) against that environment's Postgres.
5. A failed migrate exits non-zero and aborts the rollout. The previous
   deployment keeps serving, and `GET /health` still serves 200 with no database.

Do **not** put the seed script on `preDeployCommand`. Signup already writes the
starter workspace for new accounts.

### Production's pre-existing `openpath_app` (QVE-135)

Production Postgres is not empty. Its `openpath_app` schema predates these
migrations and still holds 26 tables from the pre-QVE-84 legacy app (`users`,
`profiles`, `conversations`, `openings`, `waitlist`, ...), plus stray Better
Auth tables in `public`. None collide with the current tables, so the committed
migrations apply alongside them. Because the schema already existed, a bare
`CREATE SCHEMA` aborted every production rollout (Postgres `42P06`); keep 0000
idempotent.

Dropping the legacy tables is deliberate destructive work that needs its own
ticket and a backup; do not fold it into a deploy. Until then, check
`openpath_app` for a name before a migration uses it.

## Seed and local commands

`pnpm --filter api run seed` writes the same starter workspace as the signup
hook. It needs `DATABASE_URL` and `SEED_EMAIL`, plus `SEED_PASSWORD`,
`SESSION_SECRET` and `AUTH_URL` when the account does not exist yet. It skips an
account that already has Paper, Apply or Threads. Do not point it at production
unless you mean to seed one empty account.

```bash
SEED_EMAIL=dev@example.com SEED_PASSWORD='correct-horse-battery' \
  SEED_NAME=Dev pnpm --filter api run db:seed          # local, after migrate
railway run -e production --service api -- pnpm --filter api run seed

railway status                                          # linked project + environments
railway logs --service api                              # deploy and runtime logs
railway redeploy --service web                          # rebuild web with current variables
railway variable list --service api -e production --kv  # names + values
```

## When a build fails

A failed build fails the deployment and the service keeps serving its last good
deployment. The usual causes are a type error (`tsc -b` runs before `vite build`)
and a lockfile mismatch (`--frozen-lockfile`). Lint and tests are not part of
the deploy, so run `pnpm turbo run lint typecheck build test` before merging.
