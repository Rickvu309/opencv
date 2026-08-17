# Where the Coach agent runs

The product runs on **Railway**. Postgres, the TanStack Start app, and the Coach
agent are three services in the project `openpath`. Users hit one public URL,
`https://openpath.up.railway.app`. The agent is private.

## Topology

| Service | What it is | Public |
|---|---|---|
| `openpath` | TanStack Start (Vite + Nitro), `npm run build` / `npm start` | `openpath.up.railway.app` |
| `openpath-agent` | eve, `npx eve build` / `npx eve start` | no — `openpath-agent.railway.internal:8080` |
| Postgres | accounts, sessions, `AppState`, waitlist, jobs | no — `postgres.railway.internal` |

`scripts/railway-build.mjs` and `scripts/railway-start.mjs` pick which command
to run from `RAILWAY_SERVICE_NAME`, because one `railway.json` cannot say two
start commands. The web process also runs the job heartbeat hourly
(`scripts/cron-once.mjs` ~20s after boot, then hourly). `GET /api/cron` remains
a `CRON_SECRET` back door, not the production scheduler.

Nitro proxies `/eve/**` and `/.well-known/workflow/**` to the agent, same-origin
for the browser, in both development and production. Local `npm run dev` starts
Vite and `eve` together (`scripts/dev.mjs`). The proxy target is
`EVE_NEXT_PRODUCTION_ORIGIN` in production, or `EVE_DEV_ORIGIN` /
`http://127.0.0.1:2000` locally. Production start is Nitro's
`node .output/server/index.mjs` via `npm start` — not a bare Next server.

## Why not Vercel

The Coach was first co-deployed on Vercel via `withEve`. A measured turn took
43 seconds. Hobby kills that. Railway is the topology that can finish a turn.
The app now builds with Vite/Nitro on the same Railway project as the agent
and Postgres, so there is one hosting story rather than Vercel-for-the-app and
Railway-for-everything-else.

`agent/skills/` is empty: that directory is loaded by eve as the Coach's
skills. The Coach's only tool validates a payload and runs no code, so it
never needed a bash sandbox.
