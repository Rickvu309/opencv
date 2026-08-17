# How to run the database

You will have a Postgres schema you can migrate, and tests that cannot see production rows.

Prereq: Node 24 (`.nvmrc`). Node 22 cannot strip TypeScript types. Connection settings go in `.env.local` (never committed).

On the Cursor Cloud VM the default `node` on `PATH` is v22 and it shadows nvm in non-interactive shells. Select 24 first: `source "$NVM_DIR/nvm.sh" && nvm use 24`. Postgres is installed but not auto-started: `sudo pg_ctlcluster 16 main start`.

## Commands

```bash
npm run db:status      # applied vs pending
npm run db:migrate     # apply everything pending
npm run db:rollback    # undo the most recent migration
```

They act on whatever `DATABASE_URL` points at, and print the host and schema first. There is no flag to aim them elsewhere.

## Empty database

1. Provision Postgres 13+ (Railway, or local). `gen_random_uuid()` is the only version-sensitive call.
2. Put `DATABASE_URL` in `.env.local`.
3. Run `npm run db:migrate`.

That creates the `openpath` schema, `schema_migrations`, and the tables. There is no seed. An account's state is created on first `dispatch`.

If a command fails: it printed the host and schema. Confirm `DATABASE_URL` and that Postgres is up (`sudo pg_ctlcluster 16 main start` on the Cloud VM).

## Environment

| Variable | What | Where |
|---|---|---|
| `DATABASE_URL` | Full connection string | `.env.local`; Railway web and agent as `${{Postgres.DATABASE_URL}}` |
| `TEST_DATABASE_URL` | Same instance; tests use a throwaway schema | `.env.local` only |
| `DB_SCHEMA` | Optional. Default `openpath` | Almost never |

On Railway the app uses the private host `postgres.railway.internal`. The public TCP proxy is for a laptop only.

TLS on Railway: 1.3, without certificate verification (the proxy presents a self-signed cert). Localhost disables TLS in [`src/lib/db/client.ts`](../src/lib/db/client.ts).

## Schema

Everything this version owns lives in **`openpath`**, not `public`. `public` still holds an earlier product's tables, including an old `app_state`. The named schema avoids dropping that data.

Tests set `DB_SCHEMA` to `test_<random>`, create it, run, drop it. They skip when `TEST_DATABASE_URL` is absent.

## Tables

| Table | Holds |
|---|---|
| `accounts` | Username and password hash. Unique on `lower(username)`. |
| `sessions` | Session row. `id` is SHA-256 of the cookie token, not the token. |
| `app_state` | One JSONB row per account, created on first write. |
| `conversations` | Coach threads. |
| `paper_photos` | Photos on a built CV. Created as `cv_photos`, renamed in 015. |
| `paper_files` | Uploaded paper files. |
| `account_sites` | Personal-link handle. |
| `proof_pages` | Published Proof snapshots. |
| `waitlist` | Landing-page emails. |
| `plans` | Billing tier per account. |
| `jobs` | Background job queue. |
| `traces` | Coach turn traces. |
| `guardrail_violations` | Guardrail hits. |

Deleting an account cascades sessions and state.

## Write a migration

Add a numbered pair in `src/lib/db/migrations/`:

```
018_something.up.sql
018_something.down.sql
```

Both files are required. The runner refuses a missing half, a shared number, or a file that does not match the pattern.

Never edit a migration that has been applied. The runner stores a checksum of each `up` file and stops if the file changed. Write a new pair instead.
