/**
 * Everything that runs in the background.
 *
 * Two workflows today: the nightly evaluation sweep and the weekly check-in.
 * Both are registered rather than discovered, so a typo in a job's kind is an
 * unregistered-workflow failure on the row rather than a job that quietly
 * vanishes.
 */

import { getPool } from "@/lib/db/client";
import { detectDrift, rates } from "@/lib/eval/drift";
import { enqueue } from "@/lib/jobs/queue";
import type { JobContext, WorkflowRegistry } from "@/lib/jobs/runner";
import type { AgentTrace } from "@/lib/trace/types";
import { recordViolation } from "@/lib/trace/store";
import { newId } from "@/lib/trace/collector";

export const EVAL_SWEEP = "eval-sweep";
export const WEEKLY_CHECK_IN = "weekly-check-in";

/** Traces from the last `days` days, across every account. */
async function tracesSince(days: number, offsetDays = 0): Promise<AgentTrace[]> {
  const { rows } = await getPool().query<{
    id: string;
    account_id: string | null;
    started_at: Date;
    outcome: string;
    model: string | null;
  }>(
    `select id, account_id, started_at, outcome, model
       from traces
      where started_at >= now() - ($1 || ' days')::interval
        and started_at <  now() - ($2 || ' days')::interval`,
    [days + offsetDays, offsetDays],
  );
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    startedAt: row.started_at.getTime(),
    endedAt: null,
    durationMs: null,
    model: row.model,
    costUsd: null,
    outcome: row.outcome as AgentTrace["outcome"],
    spans: [],
  }));
}

/**
 * The continuous tier: look at what production did, and say if it got worse.
 *
 * Reads the acceptance signal rather than re-scoring replies, because the
 * traces do not store reply text and should not: keeping every Coach reply for
 * a fortnight to grade it later is a privacy cost this product has not asked
 * anyone to pay. What it can measure without keeping anything is whether people
 * are undoing more than they were, which ADR-002 argues is the better signal
 * anyway.
 */
async function evalSweep({ step }: JobContext): Promise<void> {
  const recent = await step("read-recent", () => tracesSince(7));
  const baseline = await step("read-baseline", () => tracesSince(21, 7));

  const verdict = await step("detect-drift", async () =>
    detectDrift(recent as AgentTrace[], baseline as AgentTrace[]),
  );

  await step("record", async () => {
    const summary = rates(recent as AgentTrace[]);
    if (verdict.kind !== "drift") {
      console.info("eval sweep", verdict.kind, verdict.reason, summary);
      return null;
    }
    // An alert with nowhere to go is not an alert. It lands in the same place
    // the guards' refusals land, so one screen answers "is the Coach all
    // right" rather than two.
    console.warn("eval sweep: drift", verdict.reason);
    await recordViolation({
      id: newId(),
      traceId: null,
      accountId: null,
      guard: "output",
      rule: "quality-drift",
      severity: "flag",
      detail: verdict.reason,
      sample: JSON.stringify(summary),
      at: Date.now(),
    });
    return verdict.reason;
  });
}

/**
 * The weekly nudge.
 *
 * ## Why it writes nothing and sends nothing yet
 *
 * The blueprint's retention nudge is a message to a user, and this product has
 * no channel to send one on: there is no email sender wired, and pushing a
 * notification to somebody who has not asked for one is the kind of growth
 * tactic the product's voice rules out. So what runs is the half that is
 * honest: work out who would benefit from a nudge and what it would say, and
 * record it.
 *
 * That is not a placeholder. The selection is the hard part and the part worth
 * testing, and the moment a channel exists this becomes one more step rather
 * than a feature.
 */
async function weeklyCheckIn({ step }: JobContext): Promise<void> {
  const candidates = await step("select", async () => {
    const { rows } = await getPool().query<{ account_id: string; username: string }>(
      `select a.id as account_id, a.username
         from accounts a
         join app_state s on s.account_id = a.id
        where s.updated_at < now() - interval '7 days'
          and s.updated_at > now() - interval '60 days'
        limit 200`,
    );
    return rows;
  });

  await step("record", async () => {
    // Logged rather than sent. See the note above: there is no channel, and
    // inventing one is a bigger decision than a background job should make.
    console.info(
      `weekly check-in: ${candidates.length} accounts quiet for a week`,
    );
    return candidates.length;
  });
}

export const WORKFLOWS: WorkflowRegistry = {
  [EVAL_SWEEP]: evalSweep,
  [WEEKLY_CHECK_IN]: weeklyCheckIn,
};

/**
 * Put the scheduled work on the queue.
 *
 * The idempotency key is the period, which is what makes a cron that fires
 * twice harmless: both calls name the same job and the second is a no-op.
 */
export async function scheduleDue(now = new Date()): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  await enqueue({ kind: EVAL_SWEEP, idempotencyKey: day });

  // ISO week, so the weekly job runs once however often the schedule fires.
  const week = isoWeek(now);
  await enqueue({ kind: WEEKLY_CHECK_IN, idempotencyKey: week });
}

/** `2026-W33`. Stable across a year boundary, unlike "week of the year". */
export function isoWeek(date: Date): string {
  const at = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Thursday decides the year an ISO week belongs to.
  at.setUTCDate(at.getUTCDate() + 4 - (at.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(at.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((at.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${at.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
