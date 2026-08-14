import { test } from "node:test";
import assert from "node:assert/strict";

import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";
import { alreadyJoined, join, readAll } from "@/lib/waitlist/store";

const options = { skip: skipWithoutDatabase };

test("a new address is stored once", options, async () => {
  await withMigratedSchema(async (db) => {
    const first = await join("minh@example.com", "landing", db);
    const second = await join("MINH@Example.com", "end-of-demo", db);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(await alreadyJoined(" minh@EXAMPLE.com ", db), true);

    const all = await readAll(db);
    assert.equal(all.length, 1);
    assert.equal(all[0].email, "minh@example.com");
    assert.equal(all[0].source, "landing");
  });
});

test("two different people are two rows, newest first", options, async () => {
  await withMigratedSchema(async (db) => {
    await join("first@example.com", "landing", db);
    await join("second@example.com", "end-of-demo", db);
    const all = await readAll(db);
    assert.deepEqual(
      all.map((entry) => entry.email),
      ["second@example.com", "first@example.com"],
    );
  });
});
