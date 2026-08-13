/**
 * Where traces and violations land.
 *
 * Every write here is best-effort by contract: the callers wrap these so a
 * failure is logged and swallowed. A sink that can take a Coach turn down is
 * worse than no sink at all.
 */

import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client";
import {
  isOutcome,
  type AgentTrace,
  type GuardrailViolation,
  type TraceSpan,
  type TurnOutcome,
} from "@/lib/trace/types";

/**
 * How long a trace is kept.
 *
 * Diagnostic data, not the user's work. Two weeks is long enough to see a
 * regression after a deploy and short enough that the table cannot become a
 * liability nobody remembers agreeing to hold.
 */
export const RETENTION_DAYS = 14;

/** Store a finished trace, then prune what has aged out for that account. */
export async function recordTrace(
  trace: AgentTrace,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into traces
       (id, account_id, started_at, ended_at, duration_ms, model, cost_usd, outcome, spans)
     values ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0), $5, $6, $7, $8, $9)
     on conflict (id) do update
       set ended_at = excluded.ended_at,
           duration_ms = excluded.duration_ms,
           model = excluded.model,
           cost_usd = excluded.cost_usd,
           outcome = excluded.outcome,
           spans = excluded.spans`,
    [
      trace.id,
      trace.accountId,
      trace.startedAt,
      trace.endedAt,
      trace.durationMs,
      trace.model,
      trace.costUsd,
      trace.outcome,
      JSON.stringify(trace.spans),
    ],
  );
  await prune(trace.accountId, db);
}

/** Store a violation. */
export async function recordViolation(
  violation: GuardrailViolation,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into guardrail_violations
       (id, trace_id, account_id, guard, rule, severity, detail, sample, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9 / 1000.0))
     on conflict (id) do nothing`,
    [
      violation.id,
      violation.traceId,
      violation.accountId,
      violation.guard,
      violation.rule,
      violation.severity,
      violation.detail,
      violation.sample,
      violation.at,
    ],
  );
}

/**
 * Whether the user kept the change.
 *
 * Separate from `recordTrace` because it arrives later: the trace is written
 * when the turn ends, and the undo click can come seconds afterwards.
 */
export async function markOutcome(
  traceId: string,
  outcome: TurnOutcome,
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<boolean> {
  if (!isOutcome(outcome)) return false;
  // Scoped by account as well as id, so knowing a trace id is not enough to
  // rewrite somebody else's record.
  const { rowCount } = await db.query(
    "update traces set outcome = $1 where id = $2 and account_id = $3",
    [outcome, traceId, accountId],
  );
  return (rowCount ?? 0) > 0;
}

/** Drop this account's traces past the retention window. */
export async function prune(
  accountId: string | null,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<number> {
  const { rowCount } = accountId
    ? await db.query(
        `delete from traces
          where account_id = $1
            and started_at < now() - ($2 || ' days')::interval`,
        [accountId, RETENTION_DAYS],
      )
    : await db.query(
        `delete from traces
          where account_id is null
            and started_at < now() - ($1 || ' days')::interval`,
        [RETENTION_DAYS],
      );
  return rowCount ?? 0;
}

type TraceRow = {
  id: string;
  account_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  duration_ms: number | null;
  model: string | null;
  cost_usd: string | null;
  outcome: string;
  spans: unknown;
};

function toTrace(row: TraceRow): AgentTrace {
  return {
    id: row.id,
    accountId: row.account_id,
    startedAt: row.started_at.getTime(),
    endedAt: row.ended_at ? row.ended_at.getTime() : null,
    durationMs: row.duration_ms,
    model: row.model,
    // `numeric` comes back as a string, because a float would quietly round
    // fractions of a cent that are the whole point of the column.
    costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
    outcome: isOutcome(row.outcome) ? row.outcome : "pending",
    spans: Array.isArray(row.spans) ? (row.spans as TraceSpan[]) : [],
  };
}

/** The account's most recent turns, newest first. */
export async function recentTraces(
  accountId: string,
  limit = 50,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<AgentTrace[]> {
  const { rows } = await db.query<TraceRow>(
    `select id, account_id, started_at, ended_at, duration_ms, model, cost_usd, outcome, spans
       from traces
      where account_id = $1
      order by started_at desc
      limit $2`,
    [accountId, limit],
  );
  return rows.map(toTrace);
}

type ViolationRow = {
  id: string;
  trace_id: string | null;
  account_id: string | null;
  guard: string;
  rule: string;
  severity: string;
  detail: string;
  sample: string | null;
  at: Date;
};

/** The account's most recent guardrail refusals, newest first. */
export async function recentViolations(
  accountId: string,
  limit = 50,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<GuardrailViolation[]> {
  const { rows } = await db.query<ViolationRow>(
    `select id, trace_id, account_id, guard, rule, severity, detail, sample, at
       from guardrail_violations
      where account_id = $1
      order by at desc
      limit $2`,
    [accountId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    traceId: row.trace_id,
    accountId: row.account_id,
    guard: row.guard === "output" ? "output" : "input",
    rule: row.rule,
    severity:
      row.severity === "block" || row.severity === "revise"
        ? row.severity
        : "flag",
    detail: row.detail,
    sample: row.sample,
    at: row.at.getTime(),
  }));
}
