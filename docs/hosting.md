# Hosting

Railway serves the app. Vercel serves a static Storybook from the same git repo. A push to `main` is both deploys; they cannot take each other down.

## App (Railway)

One project, three services.

| Service | Start | Public |
|---|---|---|
| `web` | `npm start` — applies pending migrations, then serves | yes, the app URL |
| `worker` | `npm run worker` — drains the `jobs` queue | no |
| Postgres | managed by Railway | no (private networking) |

Both app services build from the same repo and image (`npm run build`, which typechecks first). They differ only in start command, set per service in Railway. If you use a single Railway start command, `scripts/railway-start.mjs` runs the worker when `RAILWAY_SERVICE_NAME` contains `worker`, otherwise it runs the web process.

This project's Postgres already has an older `openpath` schema. Set `DB_SCHEMA=openpath_app` on `web` and `worker` so new migrations do not collide with it.

### Environment

| Variable | Service | What |
|---|---|---|
| `DATABASE_URL` | web, worker | `${{Postgres.DATABASE_URL}}` — use the private host |
| `SESSION_SECRET` | web | 32+ characters |
| `OPENROUTER_API_KEY` | web, worker | AI. Without it the Coach shows an offline state; the rest works |
| `DB_SCHEMA` | web, worker | `openpath_app` on this project, so we do not collide with the previous app's `openpath` schema |

Local values live in `.env.local`, never committed. `.env.example` documents the set.

Vercel never receives these variables. Storybook is a static build; it has no database, no session, and no AI key.

## Storybook

Local galleries for review. `npm run storybook` starts both.

| Gallery | Command | URL |
|---|---|---|
| Opath (Production) | `npm run storybook:production` | http://localhost:6006 |
| Opath (Lab) | `npm run storybook:lab` | http://localhost:6007 |

The hosted Storybook on Vercel is Opath (Production) (`npm run build-storybook`). A second Vercel project is Git-linked to `github.com/quanvu309/openpath`. Config lives in `vercel.json` in this repo so it is reviewable: `buildCommand` is `npm run build-storybook`, `outputDirectory` is `storybook-static`, `framework` is null.

Storybook uses `.storybook/vite.config.ts` (React, Tailwind v4, path aliases) and never loads the app's `tanstackStart()` / `nitro()` plugins. `.storybook/main.ts` stubs `@tanstack/react-start` and the command client so the gallery stays browser-only.

- Production deploys on every push to `main`.
- Preview URLs on every pull request.
- Ignored Build Step is `scripts/storybook-ignored-build.sh` (exit 0 skip, exit 1 build). It skips when the commit did not touch `packages/opath-ui`, `src/ui`, `.storybook`, `src/styles`, or `package.json`.

A failed Storybook build cannot affect a Railway app deploy, and the reverse is also true.

Connecting the project is a one-time dashboard step (Import Git Repository → this repo → use `vercel.json`). No `VERCEL_TOKEN` is stored in GitHub.

## Ship an update

```bash
git push origin main
```

Railway rebuilds both services from that commit. Vercel rebuilds Storybook if the ignored-build-step paths changed. Watch the Railway deploy logs; the web service prints applied migrations before it listens.

- A failed migration fails the app deploy — the old version keeps serving rather than a broken one going live.
- Rollback is redeploying the previous commit from the Railway dashboard (or `git revert` and push). Migrations roll forward; write a new pair rather than editing an applied one ([data.md](data.md)).
- Storybook rollback is redeploying the previous Vercel deployment.

## Failure modes

| Symptom | Likely cause | Next step |
|---|---|---|
| Coach shows offline | No or invalid `OPENROUTER_API_KEY` | Set it on both Railway services; everything else should still work |
| Deploy failed at start | Pending migration failed | Read the migration error in the deploy log; fix with a new migration pair |
| Notifications or search ingestion stall | Worker down | Jobs queue up in Postgres and drain on recovery; check worker deploy logs |
| Sign-in 500s | Missing `SESSION_SECRET` | Set it; the web service refuses to boot without it rather than issuing unsigned cookies |
| Storybook 404 / old stories | Vercel ignored the build, or Storybook picked up the app Vite config | Confirm the ignored-build-step paths; Storybook must use `.storybook/vite.config.ts` (no `tanstackStart` / `nitro`) |

## Why this shape

Long streaming Coach turns rule out serverless for the app. One codebase and image keep the app deploy story to a single push. The worker is a separate service so a stuck queue can never take the app down, and vice versa ([ADR 0001](adr/0001-modular-monolith-on-railway.md)). Storybook is static, so Vercel is the right host for it and the wrong host for the app ([ADR 0006](adr/0006-port-opal.md)).
