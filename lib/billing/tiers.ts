/**
 * The plans, and what each one buys.
 *
 * Split out of `plan.ts` because the Settings screen is a client component and
 * `plan.ts` imports `pg`: bundling a Postgres driver into the browser to render
 * three prices is not a trade worth making. Types and constants here, anything
 * that touches a database next door.
 */

export type Tier = "free" | "pro" | "ultra";
export type BillingStatus = "active" | "cancelling" | "past_due" | "cancelled";

/**
 * The allowances.
 *
 * Free is twenty turns a month: enough to build a CV and a cover letter with
 * help, which is the point at which somebody knows whether this is worth ten
 * dollars. Ultra is five times Pro, as the work order specifies.
 */
export const ALLOWANCES: Record<Tier, number> = {
  free: 20,
  pro: 300,
  ultra: 1_500,
};

export const PRICES_USD: Record<Tier, number> = {
  free: 0,
  pro: 10,
  ultra: 50,
};

const TIERS: Tier[] = ["free", "pro", "ultra"];
export const BILLING_STATUSES: BillingStatus[] = [
  "active",
  "cancelling",
  "past_due",
  "cancelled",
];

export const isTier = (value: unknown): value is Tier =>
  TIERS.includes(value as Tier);
