// The queue's whole reason to exist is that a job which half-ran does not
// half-run again. These are the cases that prove it, against a real Postgres,
// because "for update skip locked" and a unique index are not things an
// in-memory fake can test.

import { test } from "node:test";
import assert from "node:assert/strict";

import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";
import {
  MAX_ATTEMPTS,
  backoffMs,
  claim,
  enqueue,
  fail,
  finish,
  readJob,
} from "@/lib/jobs/queue";
import { runDue, runOne, type WorkflowRegistry } from "@/lib/jobs/runner";
import { isoWeek } from "@/lib/jobs/workflows";

const options = { skip: skipWithoutDatabase };

test("enqueuing the same key twice makes one job", options, async () => {
  // The property that makes a cron firing twice harmless.
  await withMigratedSchema(async (db) => {
    const first = await enqueue({ kind: "test", idempotencyKey: "2026-08-13" }, db);
    const second = await enqueue({ kind: "test", idempotencyKey: "2026-08-13" }, db);
    assert.equal(second.id, first.id);
  });
});

test("different keys are different jobs", options, async () => {
  await withMigratedSchema(async (db) => {
    const a = await enqueue({ kind: "test", idempotencyKey: "mon" }, db);
    const b = await enqueue({ kind: "test", idempotencyKey: "tue" }, db);
    assert.notEqual(a.id, b.id);
  });
});

test("a job scheduled for later is not claimed now", options, async () => {
  await withMigratedSchema(async (db) => {
    await enqueue(
      {
        kind: "test",
        idempotencyKey: "later",
        runAfter: new Date(Date.now() + 60_000),
      },
      db,
    );
    assert.equal(await claim(db), null);
  });
});

test("a completed step is not run twice", options, async () => {
  // The durability contract, in the only form that matters to a person: the
  // step that sent the email does not send it again when a later step crashes.
  await withMigratedSchema(async (db) => {
    let sends = 0;
    let attempts = 0;
    const registry: WorkflowRegistry = {
      flaky: async ({ step }) => {
        await step("send", async () => {
          sends += 1;
          return "sent";
        });
        attempts += 1;
        if (attempts === 1) throw new Error("crashed after sending");
      },
    };

    await enqueue({ kind: "flaky", idempotencyKey: "one" }, db);
    const first = await runOne(registry, db);
    assert.equal(first.ran && first.ok, false, "the first run should fail");
    assert.equal(sends, 1);

    // Make it due again rather than waiting out the backoff.
    await db.query("update jobs set run_after = now()");
    const second = await runOne(registry, db);
    assert.equal(second.ran && second.ok, true, "the retry should succeed");
    assert.equal(sends, 1, "the send step must not have run twice");
  });
});

test("a step's recorded value comes back on the retry", options, async () => {
  await withMigratedSchema(async (db) => {
    const seen: unknown[] = [];
    let attempts = 0;
    const registry: WorkflowRegistry = {
      remembering: async ({ step }) => {
        const id = await step("mint", async () => `id-${Date.now()}`);
        seen.push(id);
        attempts += 1;
        if (attempts === 1) throw new Error("crash");
      },
    };
    await enqueue({ kind: "remembering", idempotencyKey: "one" }, db);
    await runOne(registry, db);
    await db.query("update jobs set run_after = now()");
    await runOne(registry, db);

    assert.equal(seen.length, 2);
    assert.equal(seen[0], seen[1], "the retry must see the value it recorded");
  });
});

test("a job that keeps failing gives up, loudly", options, async () => {
  await withMigratedSchema(async (db) => {
    const registry: WorkflowRegistry = {
      doomed: async () => {
        throw new Error("nope");
      },
    };
    const job = await enqueue({ kind: "doomed", idempotencyKey: "one" }, db);

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await db.query("update jobs set run_after = now()");
      await runOne(registry, db);
    }

    const after = await readJob(job.id, db);
    assert.equal(after?.status, "failed");
    // Failed with a reason on the row, not silently stopped.
    assert.match(after?.lastError ?? "", /nope/);
  });
});

test("an unregistered kind fails immediately rather than retrying", options, async () => {
  // A deploy problem, not a transient one. Five retries against a workflow
  // that does not exist is five wasted runs and a confusing row.
  await withMigratedSchema(async (db) => {
    const job = await enqueue({ kind: "not-a-workflow", idempotencyKey: "one" }, db);
    const result = await runOne({}, db);
    assert.equal(result.ran, true);
    assert.match((result as { error?: string }).error ?? "", /no workflow registered/);
    const after = await readJob(job.id, db);
    assert.match(after?.lastError ?? "", /no workflow registered/);
  });
});

test("a finished job is not claimed again", options, async () => {
  await withMigratedSchema(async (db) => {
    const job = await enqueue({ kind: "test", idempotencyKey: "one" }, db);
    await finish(job.id, db);
    assert.equal(await claim(db), null);
  });
});

test("runDue stops when the queue is empty, and is bounded", options, async () => {
  await withMigratedSchema(async (db) => {
    const registry: WorkflowRegistry = { noop: async () => {} };
    for (const key of ["a", "b", "c"]) {
      await enqueue({ kind: "noop", idempotencyKey: key }, db);
    }
    const result = await runDue(registry, 10, db);
    assert.deepEqual(result, { ran: 3, failed: 0 });

    // Bounded: five queued, two allowed.
    for (const key of ["d", "e", "f", "g", "h"]) {
      await enqueue({ kind: "noop", idempotencyKey: key }, db);
    }
    assert.equal((await runDue(registry, 2, db)).ran, 2);
  });
});

test("the backoff grows and then stops growing", () => {
  // Uncapped, the fifth attempt would be days away, by which point a weekly
  // job is pointless.
  assert.ok(backoffMs(1) < backoffMs(2));
  assert.ok(backoffMs(2) < backoffMs(3));
  assert.equal(backoffMs(20), 60 * 60_000);
});

test("a failure pushes the job into the future", options, async () => {
  await withMigratedSchema(async (db) => {
    const job = await enqueue({ kind: "test", idempotencyKey: "one" }, db);
    await claim(db);
    await fail(job.id, new Error("transient"), db);
    const after = await readJob(job.id, db);
    assert.equal(after?.status, "queued");
    assert.ok((after?.runAfter.getTime() ?? 0) > Date.now(), "should not be due yet");
  });
});

test("the ISO week is stable across a year boundary", () => {
  // "week of the year" would give 2027-W01 two different answers either side of
  // 1 January, and the weekly job would run twice or not at all.
  assert.equal(isoWeek(new Date("2026-08-13T00:00:00Z")), "2026-W33");
  assert.equal(
    isoWeek(new Date("2026-12-31T00:00:00Z")),
    isoWeek(new Date("2027-01-01T00:00:00Z")),
  );
});
