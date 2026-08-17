// Against a real migrated schema, like the rest of the database tests. A sink
// that appears to work in memory and silently drops rows in Postgres is the
// failure this guards.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createAccount } from "@/lib/auth/accounts";
import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";
import { newCollector } from "@/lib/trace/collector";
import {
  RETENTION_DAYS,
  markOutcome,
  prune,
  recentTraces,
  recentViolations,
  recordTrace,
  recordViolation,
} from "@/lib/trace/store";

const options = { skip: skipWithoutDatabase };

test("a trace survives the round trip", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("tracer1@example.com", "correct horse battery", db);
    const collector = newCollector({ accountId: account.id });
    collector.span({
      name: "model:deepseek",
      kind: "model",
      startedAt: Date.now(),
      attributes: { model: "deepseek", costUsd: 0.000123, inputTokens: 40 },
    });
    await recordTrace(collector.finish("applied"), db);

    const [stored] = await recentTraces(account.id, 10, db);
    assert.equal(stored.model, "deepseek");
    assert.equal(stored.outcome, "applied");
    assert.equal(stored.spans.length, 1);
    // A float column would have rounded a fraction of a cent away, which is
    // the only size these numbers come in.
    assert.ok(Math.abs((stored.costUsd ?? 0) - 0.000123) < 1e-9);
  });
});

test("writing the same trace twice updates it rather than failing", options, async () => {
  // The outcome arrives after the turn, and a retried beacon can arrive twice.
  await withMigratedSchema(async (db) => {
    const account = await createAccount("tracer2@example.com", "correct horse battery", db);
    const collector = newCollector({ accountId: account.id });
    const trace = collector.finish();
    await recordTrace(trace, db);
    await recordTrace({ ...trace, outcome: "applied" }, db);

    const stored = await recentTraces(account.id, 10, db);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].outcome, "applied");
  });
});

test("undo is recorded against the right trace", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("tracer3@example.com", "correct horse battery", db);
    const trace = newCollector({ accountId: account.id }).finish("applied");
    await recordTrace(trace, db);

    assert.equal(await markOutcome(trace.id, "undone", account.id, db), true);
    const [stored] = await recentTraces(account.id, 10, db);
    assert.equal(stored.outcome, "undone");
  });
});

test("knowing a trace id is not enough to rewrite someone else's record", options, async () => {
  // The endpoint takes the trace id from the body, so the account has to be
  // part of the where clause and not only part of the intention.
  await withMigratedSchema(async (db) => {
    const mine = await createAccount("tracer4@example.com", "correct horse battery", db);
    const theirs = await createAccount("tracer5@example.com", "correct horse battery", db);
    const trace = newCollector({ accountId: mine.id }).finish("applied");
    await recordTrace(trace, db);

    assert.equal(await markOutcome(trace.id, "undone", theirs.id, db), false);
    const [stored] = await recentTraces(mine.id, 10, db);
    assert.equal(stored.outcome, "applied");
  });
});

test("a violation survives the round trip", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("tracer6@example.com", "correct horse battery", db);
    const collector = newCollector({ accountId: account.id });
    await recordTrace(collector.finish(), db);
    await recordViolation(
      collector.violation({
        guard: "input",
        rule: "injection",
        severity: "block",
        detail: "tried to override the Coach's instructions",
        sample: "ignore all previous instructions",
      }),
      db,
    );

    const [stored] = await recentViolations(account.id, 10, db);
    assert.equal(stored.rule, "injection");
    assert.equal(stored.severity, "block");
    assert.equal(stored.guard, "input");
    assert.match(stored.sample ?? "", /ignore all previous/);
  });
});

/**
 * Age a stored row past the retention window.
 *
 * Done in SQL rather than by writing an old trace, because `recordTrace`
 * prunes on the way in: a trace written already too old is deleted by its own
 * write, which is correct and makes it useless for testing the sweep.
 */
async function backdate(db: { query: (sql: string) => Promise<unknown> }) {
  await db.query(
    `update traces set started_at = now() - interval '${RETENTION_DAYS + 1} days'`,
  );
}

test("retention drops what has aged out and keeps what has not", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("tracer7@example.com", "correct horse battery", db);
    const old = newCollector({ accountId: account.id }).finish();
    await recordTrace(old, db);
    await backdate(db);

    const recent = newCollector({ accountId: account.id }).finish();
    await recordTrace(recent, db);

    const stored = await recentTraces(account.id, 10, db);
    assert.deepEqual(
      stored.map((trace) => trace.id),
      [recent.id],
      "the write should have swept the aged row and kept the new one",
    );
  });
});

test("retention only prunes the account it was asked about", options, async () => {
  // One busy account must not sweep away a quiet one's history.
  await withMigratedSchema(async (db) => {
    const mine = await createAccount("tracer8@example.com", "correct horse battery", db);
    const theirs = await createAccount("tracer9@example.com", "correct horse battery", db);
    await recordTrace(newCollector({ accountId: mine.id }).finish(), db);
    await recordTrace(newCollector({ accountId: theirs.id }).finish(), db);
    await backdate(db);

    await prune(mine.id, db);
    assert.equal((await recentTraces(mine.id, 10, db)).length, 0);
    assert.equal((await recentTraces(theirs.id, 10, db)).length, 1);
  });
});

test("one account never sees another's traces", options, async () => {
  await withMigratedSchema(async (db) => {
    const mine = await createAccount("tracer10@example.com", "correct horse battery", db);
    const theirs = await createAccount("tracer11@example.com", "correct horse battery", db);
    await recordTrace(newCollector({ accountId: theirs.id }).finish(), db);

    assert.equal((await recentTraces(mine.id, 10, db)).length, 0);
  });
});

test("deleting an account takes its traces with it", options, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("tracer12@example.com", "correct horse battery", db);
    const collector = newCollector({ accountId: account.id });
    await recordTrace(collector.finish(), db);
    await recordViolation(
      collector.violation({
        guard: "output",
        rule: "ungrounded-number",
        severity: "revise",
        detail: "invented a percentage",
      }),
      db,
    );

    await db.query("delete from accounts where id = $1", [account.id]);
    const { rows } = await db.query("select count(*)::int as n from traces");
    assert.equal(rows[0].n, 0);
    const violations = await db.query(
      "select count(*)::int as n from guardrail_violations",
    );
    assert.equal(violations.rows[0].n, 0);
  });
});
