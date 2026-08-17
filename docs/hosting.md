# Hosting

Railway, one project, three services. A commit pushed to `main` is the deploy; there is no other pipeline.

## Services

| Service | Start | Public |
|---|---|---|
| `openpath` (web) | `npm start` — applies pending migrations, then serves | yes, https://openpath.up.railway.app |
| `openpath-agent` (worker) | `npm run worker` — drains the `jobs` queue | no |
| Postgres | managed by Railway | no (private networking) |

Both app services build from the same repo and image (`npm run build`, which typechecks first). They share `scripts/railway-start.mjs`: if `RAILWAY_SERVICE_NAME` contains `worker` or `agent`, it runs the worker, otherwise the web process.

Production Postgres still holds the previous app's `openpath` schema (`schema_migrations` keyed by `id`). Set `DB_SCHEMA=openpath_app` on web and worker so the new migrations land in a fresh schema.

## Environment

| Variable | Service | What |
|---|---|---|
| `DATABASE_URL` | web, worker | `${{Postgres.DATABASE_URL}}` — use the private host |
| `SESSION_SECRET` | web | 32+ characters |
| `OPENROUTER_API_KEY` | web, worker | AI. Without it the Coach shows an offline state; the rest works |
| `DB_SCHEMA` | web, worker | `openpath_app` on this project, so we do not collide with the previous app's `openpath` schema |

Local values live in `.env.local`, never committed. `.env.example` documents the set.

## Ship an update

```bash
git push origin main
```

Railway rebuilds both services from that commit. Watch the deploy logs; the web service prints applied migrations before it listens.

- A failed migration fails the deploy — the old version keeps serving rather than a broken one going live.
- Rollback is redeploying the previous commit from the Railway dashboard (or `git revert` and push). Migrations roll forward; write a new pair rather than editing an applied one ([data.md](data.md)).

## Failure modes

| Symptom | Likely cause | Next step |
|---|---|---|
| Coach shows offline | No or invalid `OPENROUTER_API_KEY` | Set it on both services; everything else should still work |
| Deploy failed at start | Pending migration failed | Read the migration error in the deploy log; fix with a new migration pair |
| Notifications or search ingestion stall | Worker down | Jobs queue up in Postgres and drain on recovery; check worker deploy logs |
| Sign-in 500s | Missing `SESSION_SECRET` | Set it; the web service refuses to boot without it rather than issuing unsigned cookies |

## Why this shape

Long streaming Coach turns rule out serverless. One codebase and image keep the deploy story to a single push. The worker is a separate service so a stuck queue can never take the app down, and vice versa ([ADR 0001](adr/0001-modular-monolith-on-railway.md)).
