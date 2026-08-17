/**
 * Background work that survives a restart.
 *
 * ## Why this is not the Vercel Workflow SDK
 *
 * The blueprint names it, and this does not use it, for a reason worth stating
 * plainly rather than burying.
 *
 * The Workflow SDK's Next integration serves its runtime at
 * `/.well-known/workflow/v1/*`. On this origin that path is already taken: the
 * Coach is an eve agent, eve is built on the same runtime, and the Vite/Nitro
 * proxy mounts it there. Adding a second runtime on top would put two servers
 * on one path, and the failure mode is not a build error, it is a Coach turn
 * that starts and then hangs forever because the callback found the wrong home.
 *
 * The contracts the blueprint actually asks for are per-step durability,
 * idempotent invocation, scheduled and triggered runs, and isolation from
 * user-facing requests. All four are satisfied here on the Postgres this
 * product already depends on. If the collision is resolved later (eve moving to
 * Railway would do it), this file is the seam to replace and nothing above it
 * changes.
 *
 * ## What durability means here
 *
 * A run records each completed step and what it returned. A resumed run reads
 * that and skips them. So a workflow that sent an email in step two and crashed
 * in step three does not send the email twice, which is the only durability
 * property that matters to a person.
 */

import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client";

export type JobStatus = "queued" | "running" | "done" | "failed";

export type Job = {
  id: string;
  kind: string;
  idempotencyKey: string;
  status: JobStatus;
  input: Record<string, unknown>;
  completedSteps: Record<string, unknown>;
  attempts: number;
  runAfter: Date;
  lastError: string | null;
};

/** Give up after this many tries. A job that has failed five times is broken. */
export const MAX_ATTEMPTS = 5;

/**
 * How long to wait before trying again.
 *
 * Exponential, capped at an hour. The cap matters: an uncapped backoff on the
 * fifth attempt would be days, by which point a weekly job is pointless.
 */
export function backoffMs(attempts: number): number {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

type Row = {
  id: string;
  kind: string;
  idempotency_key: string;
  status: string;
  input: Record<string, unknown>;
  completed_steps: Record<string, unknown>;
  attempts: number;
  run_after: Date;
  last_error: string | null;
};

const toJob = (row: Row): Job => ({
  id: row.id,
  kind: row.kind,
  idempotencyKey: row.idempotency_key,
  status: row.status as JobStatus,
  input: row.input ?? {},
  completedSteps: row.completed_steps ?? {},
  attempts: row.attempts,
  runAfter: row.run_after,
  lastError: row.last_error,
});

const COLUMNS =
  "id, kind, idempotency_key, status, input, completed_steps, attempts, run_after, last_error";

/**
 * Put a job on the queue, or find the one already there.
 *
 * Idempotent by contract. Two enqueues with the same kind and key are one job,
 * which is what makes a cron that fires twice harmless: the second call gets
 * the first job back rather than creating a second.
 */
export async function enqueue(
  job: {
    kind: string;
    idempotencyKey: string;
    input?: Record<string, unknown>;
    runAfter?: Date;
  },
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Job> {
  const { rows } = await db.query<Row>(
    `insert into jobs (id, kind, idempotency_key, input, run_after)
     values (gen_random_uuid(), $1, $2, $3, coalesce($4, now()))
     on conflict (kind, idempotency_key) do update
       -- A no-op update rather than DO NOTHING, so the existing row comes
       -- back. DO NOTHING returns no rows, and the caller cannot tell an
       -- idempotent hit from a failure.
       set updated_at = jobs.updated_at
     returning ${COLUMNS}`,
    [job.kind, job.idempotencyKey, JSON.stringify(job.input ?? {}), job.runAfter ?? null],
  );
  return toJob(rows[0]);
}

/**
 * Take the next due job, if there is one.
 *
 * `for update skip locked` is what makes two runners safe: each takes a
 * different row rather than both taking the same one and doing the work twice.
 */
export async function claim(
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Job | null> {
  const { rows } = await db.query<Row>(
    `update jobs
        set status = 'running', attempts = attempts + 1, updated_at = now()
      where id = (
        select id from jobs
         where status in ('queued', 'running')
           and run_after <= now()
           and attempts < $1
         order by run_after
         limit 1
         for update skip locked
      )
     returning ${COLUMNS}`,
    [MAX_ATTEMPTS],
  );
  return rows[0] ? toJob(rows[0]) : null;
}

/** Record a step's result so a resumed run can skip it. */
export async function completeStep(
  jobId: string,
  step: string,
  result: unknown,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `update jobs
        set completed_steps = completed_steps || jsonb_build_object($2::text, $3::jsonb),
            updated_at = now()
      where id = $1`,
    [jobId, step, JSON.stringify(result ?? null)],
  );
}

export async function finish(
  jobId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    "update jobs set status = 'done', last_error = null, updated_at = now() where id = $1",
    [jobId],
  );
}

/**
 * A run failed. Back off and try again, or give up.
 *
 * Giving up is a state, not a silence: `failed` with the error on the row, so
 * somebody looking at the table can see what happened rather than finding a job
 * that has simply stopped moving.
 */
export async function fail(
  jobId: string,
  error: unknown,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  // The backoff is computed in SQL because it depends on `attempts`, which the
  // row knows and the caller does not. Kept in step with `backoffMs` above:
  // 30s doubling, capped at an hour.
  await db.query(
    `update jobs
        set status = case when attempts >= $2 then 'failed' else 'queued' end,
            run_after = now() + (
              least(3600000, 30000 * power(2, greatest(0, attempts - 1)))::bigint
              || ' milliseconds'
            )::interval,
            last_error = $3,
            updated_at = now()
      where id = $1`,
    [jobId, MAX_ATTEMPTS, message.slice(0, 1_000)],
  );
}

export async function readJob(
  id: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Job | null> {
  const { rows } = await db.query<Row>(
    `select ${COLUMNS} from jobs where id = $1`,
    [id],
  );
  return rows[0] ? toJob(rows[0]) : null;
}

/** Recent jobs, newest first. For the operator, and for the tests. */
export async function recentJobs(
  limit = 50,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Job[]> {
  const { rows } = await db.query<Row>(
    `select ${COLUMNS} from jobs order by created_at desc limit $1`,
    [limit],
  );
  return rows.map(toJob);
}
