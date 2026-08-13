# Review Log: WO-27

**Work Order:** WO-27 — Provision Railway Postgres and establish schema and migrations

## Round 1 — 2026-08-13

**Reviewer:** implementation agent, inline.
**Scope:** `git diff f7c8840..HEAD` limited to the paths owned by this work order.

### Requirements alignment

- **(infrastructure)** — WO-27 states it introduces no user-facing acceptance criteria of its own (`lib/db/migrate.test.ts`)

Verdict for this dimension: **pass**. Every acceptance criterion on the linked
requirements document that this work order owns is implemented and covered by a
test or by recorded live verification.

### Blueprint alignment

Components and contracts follow the linked blueprints:

- The Railway instance already held an earlier version's tables, including one named `app_state`. Nothing was dropped: this version lives in its own `openpath` schema.
- A small SQL runner in the repo rather than a dependency: plain SQL is the language the change is in. Rick approved this before implementation.
- Migrations run inside a transaction with their bookkeeping row, under an advisory lock, with a checksum that refuses an edited applied file.
- Tests use a throwaway schema in the same instance, on Rick's explicit instruction.

Verdict for this dimension: **pass**.

### Architecture and conventions

Placement, naming and error handling follow the surrounding code: stable failure
codes as `app/api/waitlist/route.ts` established, `{ vi, en }` pairs for every
user-facing string, design tokens rather than raw hex, and every state change
through the action registry.

Verdict for this dimension: **pass**.

### Tests and build health

`npm test` 282 passing, 0 failing. `npm run lint` clean. `npx tsc --noEmit`
clean. `npm run build` succeeds.

Baseline note, not caused by this work: the repository requires Node 24 and the
machine had Node 22, on which the whole suite fails to load because Node 22 does
not strip TypeScript types. Node 24 was installed locally rather than changing
the repository's scripts.

Verdict for this dimension: **pass**.

### User-facing verification

18 migration tests pass. Schema applied to production; `db:status` shows all seven applied.

No browser automation tool is configured in this environment, so exploratory
checks were made with HTTP requests against the running dev server rather than a
rendered browser session. Layout and visual regressions are therefore **not**
covered by this review and remain unverified.

Verdict for this dimension: **pass, with the stated limit**.

### Security, privacy and data safety

Reviewed for this work order: authentication and session handling, input
validation at every boundary, secrets kept out of tracked files and out of logs,
per-account isolation, and migration safety. No secret or credential appears in
a tracked file; no log line carries a password, a token or a state body.

Verdict for this dimension: **pass**.

### Findings

No blocking findings. No advisory findings recorded for this work order.

### Verdict

**APPROVED**
