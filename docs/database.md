# The database

Postgres on Railway, in the project `openpath`. It holds accounts, sessions and
each account's `AppState`. Nothing else in the product needs it: the waiting
list stays on Blob storage, and an unauthenticated visitor never reaches it.

## Where it is

| | |
|---|---|
| Provider | Railway managed Postgres, image `postgres-ssl:18` |
| Project | `openpath` (The Redcat Studio) |
| Region | Southeast Asia |
| Reached from the app | the public TCP proxy, because the app runs on Vercel and is not on Railway's private network |
| Transport | TLS 1.3, without certificate verification (Railway's proxy presents a self-signed certificate) |

## Which schema

Everything this version owns lives in the Postgres schema **`openpath`**, not in
`public`.

`public` already held the tables of an earlier version of this product,
including one also called `app_state`. Taking that name would have meant
dropping data this codebase never wrote. The named schema avoids the question,
and it costs one `search_path` setting, which `lib/db/client.ts` puts on every
connection.

Set `DB_SCHEMA` to override it. Tests do exactly that, with a throwaway name.

## Environment variables

Both are server-side only. Neither is ever committed: `.gitignore` excludes
`.env*`, and no value is read from a tracked file.

| Variable | What it is | Where it must be set |
|---|---|---|
| `DATABASE_URL` | the full connection string, using the public proxy host | `.env.local` for development, and the Vercel project for deployment |
| `TEST_DATABASE_URL` | the same instance; the tests isolate themselves by schema, not by database | `.env.local` only, never on Vercel |
| `DB_SCHEMA` | optional; defaults to `openpath` | nowhere, normally |

The value of `DATABASE_URL` is on the Railway service, under the Postgres
plugin's variables. Build it from `PGUSER`, `PGPASSWORD`, `PGDATABASE` and the
**proxy** host and port (`RAILWAY_TCP_PROXY_DOMAIN`, `RAILWAY_TCP_PROXY_PORT`).
The `DATABASE_URL` that Railway itself publishes points at
`postgres.railway.internal`, which resolves only inside Railway and not from
Vercel.

## Commands

```bash
npm run db:status      # what is applied, what is pending
npm run db:migrate     # apply everything pending
npm run db:rollback    # undo the most recent migration, one at a time
```

They act on whatever `DATABASE_URL` points at, and print the host and schema
before doing anything. There is no flag to aim them somewhere else.

## Starting from an empty database

1. Provision Postgres on Railway, or point `DATABASE_URL` at any Postgres 13 or
   newer (`gen_random_uuid()` is the only version-sensitive thing used).
2. Put `DATABASE_URL` in `.env.local`.
3. Run `npm run db:migrate`.

That creates the schema, the `schema_migrations` bookkeeping table, and the
three tables below. Nothing else is needed; there is no seed step, because an
account's state is created the first time that account dispatches an action.

## The tables

| Table | Holds |
|---|---|
| `accounts` | `id`, `username`, `password_hash`, `created_at`. Unique on `lower(username)`. |
| `sessions` | `id`, `account_id`, `expires_at`, `created_at`. The `id` is the SHA-256 of the cookie's token, not the token. |
| `app_state` | `account_id`, `state jsonb`, `updated_at`. One row per account, at most, created on first write. |

Deleting an account removes its sessions and its state, by cascade.

## Writing a migration

Add a numbered pair in `lib/db/migrations/`:

```
004_something.up.sql
004_something.down.sql
```

Both files are required. The runner refuses a pair with a half missing, refuses
two migrations sharing a number, and refuses a `.sql` file that does not match
the naming pattern, because a migration that is silently skipped is worse than
one that fails loudly.

**Never edit a migration that has been applied.** The runner records a checksum
of each `up` file and refuses to continue when the file no longer matches. Write
a new migration instead.

## Tests

The database tests run against the real instance, inside a schema named
`test_<random>` that is created at the start of the test and dropped at the end.
They cannot see the application's tables, because those are not on the test's
`search_path`.

They skip themselves when `TEST_DATABASE_URL` is absent, so `npm test` still
passes on a machine with no network.

Requires Node 24 (`.nvmrc`). Node 22 does not strip TypeScript types, and the
whole suite fails to load on it.
