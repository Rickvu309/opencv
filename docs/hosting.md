# How to ship an update

A commit on `main`, pushed to GitHub, is the deploy. Railway rebuilds both services. There is no PR step and no Vercel.

Live URL: `https://openpath.up.railway.app`.

## Ship it

```bash
git add -A
git commit -m "Why this change exists."
git push origin main
```

Watch the Railway project `openpath`. Both `openpath` and `openpath-agent` should rebuild from that commit. When they are live, hit the URL above.

Do not open a pull request for an update. Do not deploy from another branch. The GitHub repo homepage may still say `openpath-app.vercel.app`; that is stale. Production is Railway only.

## Already set in Railway, not in git

The GitHub connection (this repo, branch `main`) and the env vars live in the Railway project.

| Variable | Service | What |
|---|---|---|
| `DATABASE_URL` | web and agent | `${{Postgres.DATABASE_URL}}` |
| `SESSION_SECRET` | web | at least 32 characters |
| `EVE_NEXT_PRODUCTION_ORIGIN` | web | private agent origin, `http://openpath-agent.railway.internal:8080` |
| `OPENROUTER_API_KEY` | agent | Coach replies. Without it the agent 503s; Auth, Paper, and the rest still work. |
| `CRON_SECRET` | web | optional. `GET /api/cron` back door, not the production scheduler |

## Services

Users hit one URL. The Coach agent and Postgres stay private on the same Railway project (`openpath`).

| Service | What | Public |
|---|---|---|
| `openpath` | TanStack Start. `npm run build` / `npm start` | `openpath.up.railway.app` |
| `openpath-agent` | eve. `npx eve build` / `npx eve start` | no (`openpath-agent.railway.internal:8080`) |
| Postgres | Accounts, sessions, AppState, waitlist, jobs | no (`postgres.railway.internal`) |

One `railway.json` cannot name two start commands. [`scripts/railway-build.mjs`](../scripts/railway-build.mjs) and [`scripts/railway-start.mjs`](../scripts/railway-start.mjs) pick the command from `RAILWAY_SERVICE_NAME`. The web `build` typechecks (`tsc --noEmit`) then runs `vite build`.

The web process also runs the job heartbeat: [`scripts/cron-once.mjs`](../scripts/cron-once.mjs) about 20s after boot, then hourly.

## Same-origin Coach

Nitro proxies `/eve/**` and `/.well-known/workflow/**` to the agent in both dev and prod.

| Environment | How the agent starts | Proxy target |
|---|---|---|
| Local | `npm run dev` starts Vite and eve (`scripts/dev.mjs`) | `EVE_DEV_ORIGIN` or `http://127.0.0.1:2000` |
| Production | Separate Railway service | `EVE_NEXT_PRODUCTION_ORIGIN` |

Production web start is `node .output/server/index.mjs` via `npm start`.

`agent/skills/` is empty. The Coach's only tool validates a payload. It never needed a bash sandbox.

## Why Railway, not Vercel

The Coach used to ride along on Vercel via `withEve`. A measured turn took 43 seconds. Hobby kills that. Railway can finish a turn, and the app, agent, and Postgres share one project.

If Sign in shows “This page couldn't load”: the last deploy shipped a runtime throw (the `npm run build` typecheck is meant to catch the missing-name case). Check the Railway deploy log, then push a fix to `main`.

If the agent 503s: that is expected without `OPENROUTER_API_KEY`. Auth, Paper, and the rest still work.
