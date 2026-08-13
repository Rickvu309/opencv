# Implementation Plan: WO-44

**Work Order:** WO-44 - Build the durable workflow runner and job queue

## The deviation, stated first

The blueprint names the Vercel Workflow SDK. This does not use it, and the
reason is a collision rather than a preference.

The SDK's Next integration serves its runtime at `/.well-known/workflow/v1/*`.
On this origin that path is already taken: the Coach is an eve agent, eve is
built on the same runtime, and `withEve` mounts it there. `next.config.ts`
already carries a comment warning that an origin serving one and not the other
produces a Coach turn that starts and hangs forever. Mounting a second runtime
on the same path invites exactly that, and it would not fail at build time.

Both packages were installed and evaluated before this call was made; `workflow`
was then removed rather than left as a dependency nobody imports.

The contracts the blueprint asks for are per-step durability, idempotent
invocation, scheduled and triggered runs, and isolation from user-facing
requests. All four are met on the Postgres this product already depends on. If
the collision is resolved later (moving eve to Railway would do it), `queue.ts`
is the seam to replace and nothing above it changes.

## What durability means here

`step(name, fn)` records what it returned. A resumed run reads that and skips
it. So a workflow that sent an email in step two and crashed in step three does
not send the email twice, which is the only durability property that matters to
a person. That is the test that matters most in `jobs.test.ts`.

## The rest

- **Idempotency** is a unique index on (kind, key), and `enqueue` returns the
  existing row rather than `DO NOTHING`, so a caller can tell an idempotent hit
  from a failure.
- **Claiming** uses `for update skip locked`, so two runners take different
  rows instead of both doing the same work.
- **Backoff** doubles from 30s and caps at an hour. Uncapped, the fifth attempt
  would be days away, by which point a weekly job is pointless.
- **Giving up is a state**, not a silence: `failed` with the error on the row.
- **Scheduling** is Vercel Cron hourly against `/api/cron`, authenticated with
  `CRON_SECRET` and refusing when that is unset. The jobs decide what is due,
  so firing twelve extra times a day costs twelve no-op enqueues.
