# Deployment

The web service serves two product surfaces from one Vite build:

| Host                         | Surface                                                  | API access                                   |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `opencv.me`, `www.opencv.me` | Landing page and public `/u/:slug` Pitch pages           | Anonymous `GET /api/pitch/public/:slug` only |
| `app.opencv.me`              | Sign-in, sign-up, Home, Paper, Apply, Pitch and Settings | Same-origin `/api/*` proxy to the API        |

Caddy routes by the request host. Old public-host `/app/*`, `/sign-in` and
`/sign-up` links redirect to the app host, preserving the path and query.
The app root opens `/app`; app-host Pitch share links redirect to the public
host. Public Pitch requests discard cookies and authorization headers, and
cannot set cookies. App requests retain session cookies and stream Coach
responses without Caddy buffering.

## Railway services

`.railway/railway.ts` owns only `api` and `web` under partial `opencv-apps` in
the existing Railway project named `openpath`. Postgres, its volume and its
data remain unmanaged by this partial. The historical project and database
schema names are infrastructure identifiers, not product names.

- **web:** `apps/web/Dockerfile` builds the SPA and serves it with Caddy.
  `/health` is a process healthcheck. Attach all three web domains to this service.
- **api:** Hono on port `3001`, with `/health` and committed migrations before
  each rollout. The web proxy reaches `http://api.railway.internal:3001`.
- **Postgres:** existing service. API `DATABASE_URL` references its connection
  string. Never copy credentials into source control.

The old public API domain may remain for compatibility and diagnostics. The
production browser no longer depends on it. Private networking requires both
application services in the same Railway environment.

## Host cutover

These are deployment prerequisites, not actions performed by a GitHub PR.
Coordinate them with the release because the browser now calls its own host.

1. Add `app.opencv.me` to the existing Railway **web** service. Configure its
   DNS record using Railway's displayed target and wait for the certificate.
   Keep `opencv.me` and `www.opencv.me` on that same service. Preserve the
   original Host header through any upstream proxy.
2. Set API `PORT=3001`, `AUTH_URL=https://app.opencv.me` and
   `WEB_ORIGINS=https://app.opencv.me`. Preserve `SESSION_SECRET`,
   `DATABASE_URL`, `OPENROUTER_API_KEY` and other existing runtime settings.
   `AUTH_URL` is the browser-facing origin, without an `/api/auth` suffix.
3. Set web `API_UPSTREAM=http://api.railway.internal:3001`. Remove the old
   web `VITE_API_URL`; the production Docker build no longer reads it.
   Review the IaC plan before applying it: only the two application services
   should change, with no Postgres or volume replacement.
4. Release the matching API and web revisions together. The IaC deliberately
   preserves auth-origin variables, so applying it alone does not set them.
5. Verify the production paths below before considering the cutover complete.

Existing sessions on the old API host do not transfer to the app host. Users
sign in again. HTTPS sessions use host-only, Secure, HttpOnly, `SameSite=Lax`
cookies. Do not add a parent-domain cookie: the landing page does not need an
app session. Better Auth's trusted origins still enforce the app origin.

## Local proxy verification

After `pnpm --filter web... build`, run the Caddy contract check with a local
Caddy binary. It binds the assigned web port and a temporary
Unix socket, verifies real host routing and streaming, then removes its fixture:

```sh
CADDY_BIN=/path/to/caddy PORT="$PORT" node scripts/verify-host-routing.mjs
```

## Release smoke test

- Open `https://opencv.me` signed out and signed in. It stays the landing page;
  its sign-in and start links lead to the app host.
- Open an old `https://opencv.me/app/paper?doc=...` bookmark. Confirm the path
  and query survive the redirect, then sign in and return to that document.
- Create an account, sign out, sign in, reload, and visit Paper, Apply and Pitch
  on `app.opencv.me`. Confirm requests use the app host and the session cookie
  has no `Domain` attribute.
- Publish a Pitch, open its `https://opencv.me/u/...` link in a signed-out
  browser and reload. Private `/api/*` requests on the public host return 404.
- Send a Coach message. Confirm streamed updates arrive before completion
  through both Caddy and any external proxy, then check persistence on reload.
- Check `/health` on both services and inspect their logs for proxy/auth errors.

Email delivery is not configured in the current production auth setup. A host
cutover does not enable password-reset mail.

## Migration pipeline

The API's Railway `preDeployCommand` runs `pnpm --filter api run migrate`
before the new process starts. Commit schema changes together with generated
SQL. Do not run `push` against production or execute `run seed` in preDeploy.
A failed migration must prevent rollout; investigate it before retrying.

## Seed and local commands

Run from the repository root with local environment variables loaded:

```sh
pnpm install --frozen-lockfile
pnpm --filter api run db:generate
pnpm --filter api run migrate
pnpm --filter api run seed
pnpm dev
```

Check `apps/api/package.json` for the available database commands. Seeding is
an explicit development action. It uses `SEED_EMAIL`; a new account also needs
`SEED_PASSWORD` and `SESSION_SECRET`. Never point a local verification run at
the production database.

`VITE_API_URL` is an optional local override; the development default is
`http://localhost:3001`. Set `WEB_ORIGINS` to the assigned local web origin and
`AUTH_URL` to the local API origin. The isolated browser workflow in
`.claude/skills/verify-opencv/SKILL.md` allocates its own database and uses a
scripted Coach with no paid provider calls.

## Coach

Set `OPENROUTER_API_KEY` on the API to enable the real Coach. Without it the
API still boots and Coach returns `503 COACH_UNAVAILABLE`; `GET /health`
continues to work. Free defaults to `openrouter/free`. The current model and
limit defaults live in source and `.env.example`; Railway can override them:

| Mode                   | Model variable      | Daily turn limit variable      |
| ---------------------- | ------------------- | ------------------------------ |
| Free                   | `COACH_MODEL_FREE`  | `COACH_DAILY_TURN_LIMIT_FREE`  |
| Light                  | `COACH_MODEL_LIGHT` | `COACH_DAILY_TURN_LIMIT_LIGHT` |
| Power (internal `max`) | `COACH_MODEL_MAX`   | `COACH_DAILY_TURN_LIMIT_MAX`   |

`COACH_RUNTIME=fake` is for isolated local verification only.

## Rollback

Restore the prior web and API deployments together with their prior
`AUTH_URL`, `WEB_ORIGINS` and web build/runtime variables. Keep the web DNS
records until rollback has been verified. Recheck sign-in and public Pitch
access; sessions may require another sign-in. This change has no database
migration. A deployment rollback never means deleting Postgres, its volume or
running destructive down migrations.
