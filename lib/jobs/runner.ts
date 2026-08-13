/**
 * Running a job, one durable step at a time.
 *
 * The whole of the durability contract is in `step()`: a step that has already
 * completed on this run returns its recorded result instead of running again.
 * Everything else here is bookkeeping around that one idea.
 */

import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client";
import { claim, completeStep, fail, finish, type Job } from "@/lib/jobs/queue";

/** What a workflow is handed when it runs. */
export type JobContext = {
  job: Job;
  /**
   * Run a named step once, ever, for this job.
   *
   * The name is the identity. Two steps sharing a name in one workflow would
   * make the second inherit the first's result, silently, which is why the
   * registry below is a plain object and every workflow's steps are literals.
   */
  step: <T>(name: string, run: () => Promise<T>) => Promise<T>;
};

export type Workflow = (context: JobContext) => Promise<void>;

/** Everything that can run. Registered rather than discovered, so a typo is a
 *  missing entry rather than a job that vanishes. */
export type WorkflowRegistry = Record<string, Workflow>;

function contextFor(
  job: Job,
  db: Pick<ClientBase, "query">,
): JobContext {
  return {
    job,
    async step<T>(name: string, run: () => Promise<T>): Promise<T> {
      if (Object.hasOwn(job.completedSteps, name)) {
        // The point of the whole file: this step already happened, on a run
        // that later crashed. Doing it again is how a person gets two emails.
        return job.completedSteps[name] as T;
      }
      const result = await run();
      await completeStep(job.id, name, result ?? null, db);
      job.completedSteps[name] = result ?? null;
      return result;
    },
  };
}

/**
 * Run one due job, if there is one. Returns what it did.
 *
 * One at a time by design. This is called from a scheduled request, and a
 * handler that drained the whole queue would be a request whose duration
 * depends on how much work is waiting.
 */
export async function runOne(
  registry: WorkflowRegistry,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<{ ran: false } | { ran: true; job: Job; ok: boolean; error?: string }> {
  const job = await claim(db);
  if (!job) return { ran: false };

  const workflow = registry[job.kind];
  if (!workflow) {
    // An unregistered kind is a deploy problem, not a transient one. Failing it
    // immediately puts the reason on the row instead of retrying five times
    // against a workflow that does not exist.
    const error = `no workflow registered for "${job.kind}"`;
    await fail(job.id, new Error(error), db);
    return { ran: true, job, ok: false, error };
  }

  try {
    await workflow(contextFor(job, db));
    await finish(job.id, db);
    return { ran: true, job, ok: true };
  } catch (error) {
    await fail(job.id, error, db);
    return {
      ran: true,
      job,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Drain up to `limit` jobs.
 *
 * Bounded rather than "until empty": a scheduled request has a deadline, and a
 * queue that grew faster than one invocation could drain it would otherwise
 * turn every invocation into a timeout.
 */
export async function runDue(
  registry: WorkflowRegistry,
  limit = 10,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<{ ran: number; failed: number }> {
  let ran = 0;
  let failed = 0;
  for (let i = 0; i < limit; i += 1) {
    const result = await runOne(registry, db);
    if (!result.ran) break;
    ran += 1;
    if (!result.ok) failed += 1;
  }
  return { ran, failed };
}
