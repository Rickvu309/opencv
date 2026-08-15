/**
 * Counting Coach turns against what the account paid for.
 *
 * ## What refusing looks like
 *
 * Not a silent failure, and not a broken product. AC-MON-004.2 asks for a
 * sentence and an upgrade; AC-MON-004.4 asks that everything else keeps
 * working. Both matter for the same reason: somebody who has run out of Coach
 * turns still has an application due on Friday, and a product that locked their
 * CV over it would deserve to lose them.
 */

import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client";
import { planFor, type Plan } from "@/lib/billing/plan";

export type UsageVerdict =
  | { kind: "allow"; remaining: number }
  /** The allowance is spent. `plan` is what they are on now, for the prompt. */
  | { kind: "refuse"; plan: Plan };

/** May this account take another metered Coach turn? */
export async function checkAllowance(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<UsageVerdict> {
  const plan = await planFor(accountId, db);
  const remaining = plan.coachAllowance - plan.usedThisPeriod;
  return remaining > 0 ? { kind: "allow", remaining } : { kind: "refuse", plan };
}

/**
 * Record one metered turn.
 *
 * Incremented in SQL rather than read-modify-written, so two turns starting at
 * once cannot both read the same count and each write one more than it.
 *
 * Returns the count after the increment, so a caller can log the boundary
 * without a second read.
 */
export async function recordTurn(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<number> {
  await planFor(accountId, db);
  const { rows } = await db.query<{ used_this_period: number }>(
    `update plans
        set used_this_period = used_this_period + 1, updated_at = now()
      where account_id = $1
     returning used_this_period`,
    [accountId],
  );
  return rows[0]?.used_this_period ?? 0;
}

/**
 * What the user is told when the allowance is gone.
 *
 * Specific: what ran out, when it comes back, and what to do about it.
 * "Limit reached" on its own leaves somebody guessing whether the product is
 * broken.
 */
export function allowanceMessage(plan: Plan): string {
  const back = plan.periodEnd
    ? plan.periodEnd.toISOString().slice(0, 10)
    : null;
  return back
    ? `You've used all ${plan.coachAllowance} Coach turns this period. It resets on ${back}. Upgrading starts you again now.`
    : `You've used all ${plan.coachAllowance} Coach turns on the free plan. Upgrading starts you again now.`;
}
