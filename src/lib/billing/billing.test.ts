// Billing is the part of a product where a bug takes money from somebody or
// gives away what they paid for. Against a real schema, because the guarantees
// that matter here are the database's: one plan per account, an increment that
// two concurrent turns cannot lose.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createAccount } from "@/lib/auth/accounts";
import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";
import {
  ALLOWANCES,
  PRICES_USD,
  cancel,
  markPastDue,
  nextPeriodEnd,
  planFor,
  setTier,
} from "@/lib/billing/plan";
import { allowanceMessage, checkAllowance, recordTurn } from "@/lib/billing/usage";

const options = { skip: skipWithoutDatabase };
const password = "correct horse battery staple";

test("an account with no plan reads as free, without being migrated", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer1@example.com", password, db);
    const plan = await planFor(account.id, db);
    assert.equal(plan.tier, "free");
    assert.equal(plan.coachAllowance, ALLOWANCES.free);
    assert.equal(plan.usedThisPeriod, 0);
  });
});

test("AC-MON-002.2: subscribing sets the tier and its allowance", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer2@example.com", password, db);
    const plan = await setTier(
      account.id,
      "pro",
      { providerSubscriptionId: "sub_123" },
      db,
    );
    assert.equal(plan.tier, "pro");
    assert.equal(plan.coachAllowance, ALLOWANCES.pro);
    assert.equal(plan.billingStatus, "active");
    assert.ok(plan.periodEnd && plan.periodEnd.getTime() > Date.now());
  });
});

test("Ultra is five times Pro, as the work order specifies", () => {
  assert.equal(ALLOWANCES.ultra, ALLOWANCES.pro * 5);
  assert.equal(PRICES_USD.pro, 10);
  assert.equal(PRICES_USD.ultra, 50);
});

test("an upgrade does not carry the old usage across", options, async () => {
  // Selling somebody a bigger plan and handing them a bill they had already
  // spent would be the worst possible first impression of paying.
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer3@example.com", password, db);
    await recordTurn(account.id, db);
    await recordTurn(account.id, db);
    const plan = await setTier(account.id, "pro", {}, db);
    assert.equal(plan.usedThisPeriod, 0);
  });
});

test("AC-MON-004.1: turns count against the allowance", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer4@example.com", password, db);
    assert.equal(await recordTurn(account.id, db), 1);
    assert.equal(await recordTurn(account.id, db), 2);
    const verdict = await checkAllowance(account.id, db);
    assert.equal(verdict.kind, "allow");
    assert.equal(
      verdict.kind === "allow" ? verdict.remaining : 0,
      ALLOWANCES.free - 2,
    );
  });
});

test("AC-MON-004.2: reaching the allowance refuses, with something to say", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer5@example.com", password, db);
    for (let i = 0; i < ALLOWANCES.free; i += 1) {
      await recordTurn(account.id, db);
    }
    const verdict = await checkAllowance(account.id, db);
    assert.equal(verdict.kind, "refuse");
    if (verdict.kind !== "refuse") return;

    // Not a bare "limit reached": what ran out, and what to do.
    const message = allowanceMessage(verdict.plan);
    assert.match(message, /upgrad/i);
  });
});

test("AC-MON-004.3: a new period resets the count", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer6@example.com", password, db);
    await setTier(account.id, "pro", {}, db);
    await recordTurn(account.id, db);

    // Age the period out rather than waiting a month.
    await db.query("update plans set period_end = now() - interval '1 day'");
    const plan = await planFor(account.id, db);
    assert.equal(plan.usedThisPeriod, 0);
    assert.equal(plan.tier, "pro", "a renewal is not a downgrade");
    assert.ok(plan.periodEnd && plan.periodEnd.getTime() > Date.now());
  });
});

test("AC-MON-003.2: cancelling keeps the allowance until the period ends", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer7@example.com", password, db);
    await setTier(account.id, "ultra", {}, db);
    const cancelled = await cancel(account.id, db);

    // Still Ultra, still the Ultra allowance. They paid for it.
    assert.equal(cancelled.tier, "ultra");
    assert.equal(cancelled.coachAllowance, ALLOWANCES.ultra);
    assert.equal(cancelled.billingStatus, "cancelling");

    await db.query("update plans set period_end = now() - interval '1 second'");
    const after = await planFor(account.id, db);
    assert.equal(after.tier, "free");
    assert.equal(after.coachAllowance, ALLOWANCES.free);
    assert.equal(after.billingStatus, "cancelled");
  });
});

test("AC-MON-005.2: a failed payment is not an instant downgrade", options, async () => {
  // The provider retries a bounced card. Dropping somebody to free the moment
  // one payment fails would take away a plan they are about to keep paying for.
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer8@example.com", password, db);
    await setTier(account.id, "pro", {}, db);
    const overdue = await markPastDue(account.id, db);
    assert.equal(overdue.tier, "pro");
    assert.equal(overdue.billingStatus, "past_due");

    // It reverts when the subscription actually ends.
    await db.query("update plans set period_end = now() - interval '1 second'");
    assert.equal((await planFor(account.id, db)).tier, "free");
  });
});

test("cancelling a free plan is a no-op, not an error", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer9@example.com", password, db);
    const plan = await cancel(account.id, db);
    assert.equal(plan.tier, "free");
  });
});

test("deleting an account takes its plan with it", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("payer10@example.com", password, db);
    await setTier(account.id, "pro", {}, db);
    await db.query("delete from accounts where id = $1", [account.id]);
    const { rows } = await db.query("select count(*)::int as n from plans");
    assert.equal(rows[0].n, 0);
  });
});

test("a period end is always in the future", () => {
  // A long outage must not roll a plan into a period that has also passed, or
  // every read would roll it again and the user would never keep an allowance.
  const longAgo = new Date("2020-01-01T00:00:00Z");
  assert.ok(nextPeriodEnd(longAgo).getTime() > Date.now());
});
