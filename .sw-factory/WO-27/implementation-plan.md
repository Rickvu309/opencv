# Implementation Plan: WO-27

**Work Order:** WO-27 — Provision Railway Postgres and establish schema and migrations

> **As-built.** Written after implementation during the 2026-08-13 audit. For this
> work order the plan did not precede the code, which
> `execution/execute-work-order.md` step 4 requires. WO-27 and WO-23 are the
> exceptions: their plans were written first, posted to the user, and approved
> before any code was written.

## Scope

Provision Railway Postgres and establish schema and migrations

## Files

- `lib/db/client.ts`
- `lib/db/migrate.ts`
- `lib/db/testing.ts`
- `lib/db/migrations/*.sql`
- `scripts/db.mjs`
- `docs/database.md`

## Approach and decisions

- The Railway instance already held an earlier version's tables, including one named `app_state`. Nothing was dropped: this version lives in its own `openpath` schema.
- A small SQL runner in the repo rather than a dependency: plain SQL is the language the change is in. Rick approved this before implementation.
- Migrations run inside a transaction with their bookkeeping row, under an advisory lock, with a checksum that refuses an edited applied file.
- Tests use a throwaway schema in the same instance, on Rick's explicit instruction.

## Acceptance criteria and how each is met

- **(infrastructure)** — WO-27 states it introduces no user-facing acceptance criteria of its own (`lib/db/migrate.test.ts`)

## Testing

18 migration tests pass. Schema applied to production; `db:status` shows all seven applied.

## Scope notes

Provisioning was already done; the service existed and was online. Verified reachable over the public TCP proxy with TLS 1.3.
