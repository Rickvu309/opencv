# Deploying OpenCV on Railway

Railway hosts everything: the `api`, `Postgres` and the static `web` app,
behind the `opencv.me` zone on Cloudflare. There is one environment:
production. Main deploys straight to production; there is no staging and no
per-PR preview deploy yet. Rollback is a Railway redeploy of the previous
deployment (see Rollback). This file is the runbook.

Each service redeploys from `main` when a file under its watch paths changes.
Required `ci` gates merges: hosted jobs run affected lint, typecheck and build
in parallel with guards, then API tests and two web shards. Every job must
succeed; skipped or cancelled jobs fail `ci`. Production verification remains
separate.

## Layout

Railway project `opencv`.

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

The API retains GitHub source `Rickvu309/opencv` on `main`. Its `AUTH_URL`,
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
  TanStack Router routes client-side and a refresh on `/coach` must not 404.
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

`vite preview` does not exercise Caddy's routing. After building, run the real
HTTP check from `apps/web`, with `PORT` set to your assigned web port:

```bash
PORT=5450 node ./scripts/verify-host-routing.mjs
```

Set `CADDY` to the binary path if it is not on `PATH`. The check starts Caddy
against `dist` and the generated routing snippet, checks responses, then stops it.

### Public and product hosts

The split is disabled when both `VITE_PUBLIC_ORIGIN` and `VITE_APP_ORIGIN`
are unset. This preserves the current apex app on a normal main deploy.
Setting only one, invalid origins, or overlapping hostnames fails the build.
Both values are build inputs, including Turbo's cache key. Restarting an old
image does not change its routing.

When enabled, one web image serves both hosts. Sign-in, sign-up and product
paths such as `/coach` and `/paper` belong to the app origin. Pricing, about,
help, `/share/*` and future published `/u/*` pages belong to the public origin.
The public root stays the landing page even for a signed-in visitor. The app
root is the product entry and opens the start page. A request whose path is
`/app` or `/app/*` is stripped to that path on the app origin. Unknown hosts
and paths, health checks and assets keep their existing behavior. This does
not add Pitch.

The Vite build generates `.generated/host-routing.caddy` from the same policy
used by the router and landing links. Docker copies it next to the Caddyfile,
outside `/srv`. Redirects use 307 with `Cache-Control: no-store`, preserving the
path and query. Browsers preserve the fragment across the document redirect.

Production activation is a separate operator step:

1. Attach `app.opencv.me` to the existing Railway `web` service. Add Railway's
   DNS and verification records in Cloudflare and wait for valid HTTPS.
2. Add `https://app.opencv.me` to the API's `WEB_ORIGINS`, retaining the apex
   and `www` origins. Verify CORS and trusted-origin acceptance.
3. Set `VITE_PUBLIC_ORIGIN=https://opencv.me` and
   `VITE_APP_ORIGIN=https://app.opencv.me` on `web`, then rebuild it. Keep
   `VITE_API_URL=https://api.opencv.me` and `AUTH_URL=https://api.opencv.me`.
4. Check legacy sign-in and app URLs, landing-page links, an existing session,
   a new email-code sign-in, sign-out, and an anonymous shared CV. If Google is
   enabled, check its return to the app origin; its provider callback stays on
   the API origin. No cookie domain or SameSite change is needed.

To roll back, unset both web origins and rebuild, or restore the previous
single-host image. Keep the API allowlist overlap while sessions and old tabs
settle. Do not change `AUTH_URL` as part of this rollback.

For local split proof, build with both origins set, then run the HTTP check
with the same values and `--split`. Browser proof also needs the API to allow
both local origins. Use the worktree's assigned ports.

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
matches a single DNS label. Unset means the local web dev server derived from `PORT` (`http://localhost:5173` when `PORT` is unset).
The api and web must agree: a new web origin has to be added here, or the
browser blocks the response.

## Coach

The Coach runtime is built only when `OPENROUTER_API_KEY` is set on the `api`
service. Missing or blank key: the app boots, `GET /health` stays 200, and
`POST /api/chats/:id/turns` returns 503 `COACH_UNAVAILABLE`. Auth, Paper,
Apply and Threads reads are untouched. Do not fail the deploy or the healthcheck
for a missing key. The web app only needs `VITE_API_URL`; the Coach vars are
`api` variables.

| Variable                          | Required               | Default             | Notes                                           |
| --------------------------------- | ---------------------- | ------------------- | ----------------------------------------------- |
| `OPENROUTER_API_KEY`              | Yes, for Free accounts | none                | Free routes through OpenRouter.                 |
| `ANTHROPIC_API_KEY`               | Yes, for Pro accounts  | none                | Pro routes directly to Anthropic.               |
| `OPENROUTER_BASE_URL`             | No                     | provider URL        | Local stub only; never production.              |
| `COACH_MODEL_FREE`                | No                     | `openrouter/free`   | Free account model; the answering model varies. |
| `COACH_MODEL_PRO_FREE`            | No                     | `claude-haiku-5-5`  | Pro account, Free mode.                         |
| `COACH_MODEL_LIGHT`               | No                     | `claude-sonnet-5-5` | Pro account, Light mode.                        |
| `COACH_MODEL_MAX`                 | No                     | `claude-opus-5-5`   | Pro account, Max mode.                          |
| `COACH_DAILY_TURN_LIMIT_FREE`     | No                     | `20`                | Free account daily cap.                         |
| `COACH_DAILY_TURN_LIMIT_PRO_FREE` | No                     | `0`                 | Pro Free mode; zero means uncapped.             |
| `COACH_DAILY_TURN_LIMIT_LIGHT`    | No                     | `10`                | Pro Light daily cap.                            |
| `COACH_DAILY_TURN_LIMIT_MAX`      | No                     | `5`                 | Pro Max daily cap.                              |
| `COACH_SESSION_HOURS`             | No                     | `4`                 | Session usage display window.                   |
| `COACH_RUNTIME`                   | No                     | live provider       | `fake` is for local protocol checks only.       |

These are the routes and caps implemented by `packages/domain/src/usage.ts`.
Daily windows start at 07:00 in the person's timezone. Session and weekly
meters describe usage; only the daily mode cap rejects a turn. Admission counts
an attempted turn, including an error or Stop. Model IDs can be overridden
without changing code; check access with the deployment account before rollout.

Keep one API process for now: explicit Stop uses process-local controllers.
Provider calls have a two-minute turn timeout, a 30-second idle chunk timeout,
one provider retry, a 4,096-token output ceiling and at most eight tool steps.
An unfinished usage row blocks a second turn in the same chat for five minutes.
After a crash, wait for that window before retrying. Regenerate only generates
text; it does not repeat earlier commands. See [Coach research and release scope](coach.md).

```bash
printf '%s' "$OPENROUTER_API_KEY" | railway variable set OPENROUTER_API_KEY --stdin \
  --project opencv --environment production --service api
```

Setting a variable redeploys `api`. When the rollout is SUCCESS:

```bash
COACH_SMOKE_API=https://api.opencv.me COACH_SMOKE_MODE=production pnpm --filter api smoke
```

Production mode asks for advice that cites workspace state and a Command
(`job.move`) and looks for the receipt.

Sign-in recovery: [auth](deploy/auth.md). After a merge: [check](deploy/verify.md), [health](deploy/health.md).

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

1. Edit the TypeScript tables in `apps/api/src/db/schema.ts`, all in
   `pgSchema("opencv_app")`. No migration deletes data.
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

### Production holds only `opencv_app`

On 2026-10-27 the OpenPath-era leftovers were dropped from production Postgres:
the `openpath`, `openpath_app`, `drizzle` and `test_*` schemas and the stray
Better Auth tables in `public`. `opencv_app` is the only schema with tables, and
`public` is empty. Migration 0000 still uses `CREATE SCHEMA IF NOT EXISTS`; keep
it idempotent.

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
