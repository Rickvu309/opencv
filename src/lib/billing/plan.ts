/**
 * What an account pays for, and how much Coach it gets.
 *
 * ## What is metered, and what is not
 *
 * Coach turns. Not documents, not applications, not the CV builder. The
 * blueprint's ADR calls it "meter usage, not features", and the reason is
 * product rather than accounting: a student who has run out of Coach turns
 * still has a CV to finish and an application due on Friday, and taking those
 * away would be punishing them for the one thing that costs us money.
 *
 * ## Why the allowance is stored, not derived from the tier
 *
 * A price change should not retroactively alter what somebody already bought.
 * The tier says which plan they are on; `coachAllowance` says what they were
 * promised, and only a plan change rewrites it.
 */

import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client.server";
import {
  ALLOWANCES,
  BILLING_STATUSES,
  isTier,
  type BillingStatus,
  type Tier,
} from "@/lib/billing/tiers";

export { ALLOWANCES, PRICES_USD, isTier } from "@/lib/billing/tiers";
export type { Tier, BillingStatus } from "@/lib/billing/tiers";

export type Plan = {
  accountId: string;
  tier: Tier;
  coachAllowance: number;
  usedThisPeriod: number;
  periodEnd: Date | null;
  providerSubscriptionId: string | null;
  billingStatus: BillingStatus;
};

type Row = {
  account_id: string;
  tier: string;
  coach_allowance: number;
  used_this_period: number;
  period_end: Date | null;
  provider_subscription_id: string | null;
  billing_status: string;
};

const toPlan = (row: Row): Plan => ({
  accountId: row.account_id,
  tier: isTier(row.tier) ? row.tier : "free",
  coachAllowance: row.coach_allowance,
  usedThisPeriod: row.used_this_period,
  periodEnd: row.period_end,
  providerSubscriptionId: row.provider_subscription_id,
  billingStatus: BILLING_STATUSES.includes(row.billing_status as BillingStatus)
    ? (row.billing_status as BillingStatus)
    : "active",
});

const COLUMNS =
  "account_id, tier, coach_allowance, used_this_period, period_end, provider_subscription_id, billing_status";

/**
 * The account's plan, creating the free one if it has none.
 *
 * Read-through rather than created at sign-up, so an account that predates
 * billing behaves exactly like one that does not: everybody has a plan, and
 * nobody had to be migrated into one.
 */
export async function planFor(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Plan> {
  const { rows } = await db.query<Row>(
    `insert into plans (account_id, tier, coach_allowance)
     values ($1, 'free', $2)
     on conflict (account_id) do update set updated_at = plans.updated_at
     returning ${COLUMNS}`,
    [accountId, ALLOWANCES.free],
  );
  return rollIfExpired(toPlan(rows[0]), db);
}

/**
 * A period that has ended is applied on read.
 *
 * Two things happen at the boundary and both have to be true the instant
 * somebody looks: the usage count resets (AC-MON-004.3), and a cancelling plan
 * becomes free (AC-MON-003.2). Doing it here rather than in a nightly job means
 * there is no window in which the database disagrees with what the user is
 * owed.
 */
async function rollIfExpired(
  plan: Plan,
  db: Pick<ClientBase, "query">,
): Promise<Plan> {
  if (!plan.periodEnd || plan.periodEnd.getTime() > Date.now()) return plan;

  const ending = plan.billingStatus === "cancelling" || plan.billingStatus === "past_due";
  const next: Plan = ending
    ? {
        ...plan,
        tier: "free",
        coachAllowance: ALLOWANCES.free,
        usedThisPeriod: 0,
        periodEnd: null,
        providerSubscriptionId: null,
        billingStatus: "cancelled",
      }
    : {
        ...plan,
        usedThisPeriod: 0,
        periodEnd: nextPeriodEnd(plan.periodEnd),
      };

  await db.query(
    `update plans
        set tier = $2, coach_allowance = $3, used_this_period = $4,
            period_end = $5, provider_subscription_id = $6,
            billing_status = $7, updated_at = now()
      where account_id = $1`,
    [
      plan.accountId,
      next.tier,
      next.coachAllowance,
      next.usedThisPeriod,
      next.periodEnd,
      next.providerSubscriptionId,
      next.billingStatus,
    ],
  );
  return next;
}

/** A month on from the last boundary, not from now: periods must not drift. */
export function nextPeriodEnd(from: Date): Date {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  // A period that is already in the past (a long outage) rolls forward to the
  // next one that is not, rather than landing in the past again.
  while (next.getTime() <= Date.now()) {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

/** Put the account on a tier. Called after checkout and from the webhook. */
export async function setTier(
  accountId: string,
  tier: Tier,
  options: {
    providerSubscriptionId?: string | null;
    periodEnd?: Date | null;
    billingStatus?: BillingStatus;
  } = {},
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Plan> {
  await planFor(accountId, db);
  const { rows } = await db.query<Row>(
    `update plans
        set tier = $2,
            coach_allowance = $3,
            -- A tier change starts a fresh allowance. Carrying usage across an
            -- upgrade would sell somebody a bigger plan and hand them a bill
            -- they had already spent.
            used_this_period = 0,
            period_end = coalesce($4, period_end),
            provider_subscription_id = coalesce($5, provider_subscription_id),
            billing_status = $6,
            updated_at = now()
      where account_id = $1
     returning ${COLUMNS}`,
    [
      accountId,
      tier,
      ALLOWANCES[tier],
      options.periodEnd ?? (tier === "free" ? null : nextPeriodEnd(new Date())),
      options.providerSubscriptionId ?? null,
      options.billingStatus ?? (tier === "free" ? "cancelled" : "active"),
    ],
  );
  return toPlan(rows[0]);
}

/**
 * A renewal did not go through.
 *
 * Deliberately not a downgrade. The provider retries a failed card, and
 * dropping somebody to free the moment one payment bounces would take away a
 * plan they are about to keep paying for. AC-MON-005.2 asks us to follow the
 * provider's outcome, so this only records the state; the revert happens at the
 * period boundary, in `rollIfExpired`, if the subscription really ended.
 */
export async function markPastDue(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Plan> {
  await planFor(accountId, db);
  const { rows } = await db.query<Row>(
    `update plans set billing_status = 'past_due', updated_at = now()
      where account_id = $1 returning ${COLUMNS}`,
    [accountId],
  );
  return toPlan(rows[0]);
}

/**
 * Cancel, keeping what was paid for.
 *
 * AC-MON-003.2: the allowance survives until the period ends. `rollIfExpired`
 * is what finishes the job, on the first read after that instant.
 */
export async function cancel(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Plan> {
  const plan = await planFor(accountId, db);
  if (plan.tier === "free") return plan;
  const { rows } = await db.query<Row>(
    `update plans set billing_status = 'cancelling', updated_at = now()
      where account_id = $1 returning ${COLUMNS}`,
    [accountId],
  );
  return toPlan(rows[0]);
}
