import { newId } from "@/core/ids";
import { withClient, withTx } from "@/core/db/client.server";
import type { PoolClient } from "pg";

export async function enqueue(
  kind: string,
  payload: unknown,
  runAt = new Date(),
  client?: PoolClient,
) {
  const id = newId();
  const run = (c: PoolClient) =>
    c.query(`insert into jobs (id, kind, payload, run_at) values ($1,$2,$3::jsonb,$4)`, [
      id,
      kind,
      JSON.stringify(payload),
      runAt.toISOString(),
    ]);
  if (client) await run(client);
  else await withClient(run);
  return id;
}

export async function claimJob(workerId: string) {
  return withTx(async (c) => {
    const { rows } = await c.query<{
      id: string;
      kind: string;
      payload: unknown;
      attempts: number;
    }>(
      `select id, kind, payload, attempts from jobs
       where failed_at is null and locked_at is null and run_at <= now()
       order by run_at
       for update skip locked
       limit 1`,
    );
    const job = rows[0];
    if (!job) return null;
    await c.query(
      `update jobs set locked_at = now(), locked_by = $1, attempts = attempts + 1 where id = $2`,
      [workerId, job.id],
    );
    return job;
  });
}

export async function finishJob(id: string) {
  await withClient((c) => c.query(`delete from jobs where id = $1`, [id]));
}

export async function failJob(id: string, error: string) {
  await withClient((c) =>
    c.query(`update jobs set failed_at = now(), error = $1, locked_at = null where id = $2`, [
      error,
      id,
    ]),
  );
}
