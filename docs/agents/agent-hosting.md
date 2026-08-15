# Where the Coach agent runs

## The short answer

The product runs on **Railway**. Postgres, the Next app, and the Coach agent
are three services in the project `openpath`. Users hit one public URL,
`https://openpath.up.railway.app`. The agent is private.

## Topology

| Service | What it is | Public |
|---|---|---|
| `openpath` | Next.js, `npm run build` / `npm start` | `openpath.up.railway.app` |
| `openpath-agent` | eve, `npx eve build` / `npx eve start` | no — `openpath-agent.railway.internal:8080` |
| Postgres | accounts, sessions, `AppState`, waitlist, jobs | no — `postgres.railway.internal` |

`scripts/railway-build.mjs` and `scripts/railway-start.mjs` pick which command
to run from `RAILWAY_SERVICE_NAME`, because one `railway.json` cannot say two
start commands. The web process also runs the job heartbeat hourly, in place
of Vercel Cron.

The Next app proxies `/eve/:path*` and `/.well-known/workflow/:path*` to the
agent, same-origin for the browser. `withEve` is still what `next dev` uses.
It is not what production uses: on Vercel it ignores
`EVE_NEXT_PRODUCTION_ORIGIN`, and off Vercel it rewrites to
`/_eve_internal/eve/eve/*`, which `eve start` does not serve. The rewrites
live in `next.config.ts` and only apply when that variable is set and `VERCEL`
is not.

## What was tried, and why Vercel is not the host

The Coach was first co-deployed on Vercel via `withEve`. A measured turn took
43 seconds. Hobby kills that. `EVE_NEXT_PRODUCTION_ORIGIN` was then set on
Vercel to point at `openpath-agent`; `withEve` never reads it when `VERCEL` is
set. Railway is the topology the Coach Agent blueprint asked for, and the one
that can finish a turn.

## What is worth keeping

`agent/skills/` is empty: that directory is loaded by eve as the *Coach's*
skills. The Coach's only tool validates a payload and runs no code, so it
never needed a bash sandbox.
