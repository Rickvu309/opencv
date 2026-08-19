# Hosting

Railway serves the app, the worker, and both Storybook galleries. A push to `main` deploys all of them. They cannot take each other down: each is its own service with its own build.

## App (Railway)

One project, five services.

| Service | Start | Public |
|---|---|---|
| `web` | `npm start` — applies pending migrations, then serves | yes, the app URL |
| `worker` | `npm run worker` — drains the `jobs` queue | no |
| Postgres | managed by Railway | no (private networking) |
| `opath-production` | static files from `storybook-static` | yes, https://opath-production.up.railway.app |
| `opath-lab` | static files from `storybook-static-ui` | yes, https://opath-lab.up.railway.app |

`web` and `worker` build with `npm run build` (typecheck first). [`scripts/railway-build.mjs`](../scripts/railway-build.mjs) and [`scripts/railway-start.mjs`](../scripts/railway-start.mjs) branch on `RAILWAY_SERVICE_NAME`: `worker` in the name runs the queue; `opath-lab` builds and serves Lab; `opath-production` builds and serves Production; otherwise the web process.

This project's Postgres already has an older `openpath` schema. Set `DB_SCHEMA=openpath_app` on `web` and `worker` so new migrations do not collide with it.

### Environment

| Variable | Service | What |
|---|---|---|
| `DATABASE_URL` | web, worker | `${{Postgres.DATABASE_URL}}` — use the private host |
| `SESSION_SECRET` | web | 32+ characters |
| `OPENROUTER_API_KEY` | web, worker | AI. Without it the Coach shows an offline state; the rest works |
| `DB_SCHEMA` | web, worker | `openpath_app` on this project, so we do not collide with the previous app's `openpath` schema |

Local values live in `.env.local`, never committed. `.env.example` documents the set.

Storybook services must not receive `DATABASE_URL`, `SESSION_SECRET`, or `OPENROUTER_API_KEY`. The gallery is a static build; [`scripts/storybook-serve.mjs`](../scripts/storybook-serve.mjs) only serves files. It keeps `iframe.html` as a real path — do not put `npx serve` in front of it (`serve` redirects `/iframe.html` to `/iframe` and the preview goes blank).

## Storybook

Local galleries for review. `npm run storybook` starts both.

| Gallery | Command | Local | Host |
|---|---|---|---|
| Opath (Production) | `npm run storybook:production` | http://localhost:6006 | https://opath-production.up.railway.app |
| Opath (Lab) | `npm run storybook:lab` | http://localhost:6007 | https://opath-lab.up.railway.app |

Same names as the old Vercel hosts (`opath-production.vercel.app`, `opath-lab.vercel.app`), on Railway’s `up.railway.app` domain. Services are named `opath-production` and `opath-lab`. Generate the public domain with `railway domain --service opath-production` / `opath-lab`. A push to `main` rebuilds them with the app.

Storybook uses `.storybook/vite.config.ts` (React, Tailwind v4, path aliases) and never loads the app's `tanstackStart()` / `nitro()` plugins. `.storybook/main.ts` stubs `@tanstack/react-start`, the command client, auth session/store, and the database client so the gallery stays browser-only.

Creating the two services is a one-time step (`railway add --service opath-production` and `opath-lab`, same Git repo as `web`). Do not copy app variables onto them.

Root [`vercel.json`](../vercel.json) and [`vercel.lab.json`](../vercel.lab.json) remain if you still want a Vercel host; Railway is the gallery this project operates.

## Cursor Cloud

A Cloud Agent environment must name scripts that exist in this repo. Install is [`scripts/cursor-cloud-install.sh`](../scripts/cursor-cloud-install.sh); start is [`scripts/cursor-cloud-start.sh`](../scripts/cursor-cloud-start.sh). Config: [`.cursor/environment.json`](../.cursor/environment.json).

## Ship an update

```bash
git push origin main
```

Railway rebuilds `web`, `worker`, `opath-production`, and `opath-lab` from that commit. Watch the Railway deploy logs; the web service prints applied migrations before it listens.

- A failed migration fails the app deploy — the old version keeps serving rather than a broken one going live.
- Rollback is redeploying the previous commit from the Railway dashboard (or `git revert` and push). Migrations roll forward; write a new pair rather than editing an applied one ([data.md](data.md)).
- Storybook rollback is redeploying the previous deployment of that Storybook service. A failed Storybook build cannot take `web` down.

## Failure modes

| Symptom | Likely cause | Next step |
|---|---|---|
| Coach shows offline | No or invalid `OPENROUTER_API_KEY` | Set it on both Railway app services; everything else should still work |
| Deploy failed at start | Pending migration failed | Read the migration error in the deploy log; fix with a new migration pair |
| Notifications or search ingestion stall | Worker down | Jobs queue up in Postgres and drain on recovery; check worker deploy logs |
| Sign-in 500s | Missing `SESSION_SECRET` | Set it; the web service refuses to boot without it rather than issuing unsigned cookies |
| Storybook 404 / blank preview | `iframe.html` redirected, or Storybook picked up the app Vite config | Serve with `scripts/storybook-serve.mjs`; Storybook must use `.storybook/vite.config.ts` (no `tanstackStart` / `nitro`) |
| Cloud Agent install exit 127 | `install`/`start` point at missing `scripts/cursor-cloud-*.sh` | Keep those scripts in git; see [AGENTS.md](../AGENTS.md) Cursor Cloud section |

## Why this shape

Long streaming Coach turns rule out serverless for the app. One codebase on Railway keeps the deploy story to a single push. The worker is a separate service so a stuck queue can never take the app down, and vice versa ([ADR 0001](adr/0001-modular-monolith-on-railway.md)). Storybook is static and runs as two more Railway services so a gallery build cannot take the Coach down ([ADR 0006](adr/0006-port-opal.md)).
