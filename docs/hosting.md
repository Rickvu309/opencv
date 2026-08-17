# How the product is hosted

Users hit one URL: `https://openpath.up.railway.app`. The Coach agent and Postgres stay private on the same Railway project (`openpath`).

## Services

| Service | What | Public |
|---|---|---|
| `openpath` | TanStack Start. `npm run build` / `npm start` | `openpath.up.railway.app` |
| `openpath-agent` | eve. `npx eve build` / `npx eve start` | no (`openpath-agent.railway.internal:8080`) |
| Postgres | Accounts, sessions, AppState, waitlist, jobs | no (`postgres.railway.internal`) |

One `railway.json` cannot name two start commands. [`scripts/railway-build.mjs`](../scripts/railway-build.mjs) and [`scripts/railway-start.mjs`](../scripts/railway-start.mjs) pick the command from `RAILWAY_SERVICE_NAME`.

The web process also runs the job heartbeat: [`scripts/cron-once.mjs`](../scripts/cron-once.mjs) about 20s after boot, then hourly. `GET /api/cron` is a `CRON_SECRET` back door, not the production scheduler.

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

GitHub: a push to `main` deploys. Details of the Railway GitHub connection live in the Railway project, not in this repo.

If the agent 503s: that is expected without `OPENROUTER_API_KEY`. Auth, Paper, and the rest still work.
