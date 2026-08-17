// Conversations followed the profile onto the server, so the questions are the
// same ones REQ-ACCT-004 asks of everything else: is it under the account, is
// it there on the next device, and can anybody else reach it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createAccount } from "@/lib/auth/accounts";
import {
  readConversations,
  sanitizeConversations,
  writeConversations,
} from "@/lib/coach/account-conversations";
import { MAX_CONVERSATIONS, MAX_EVENTS, type Conversation } from "@/lib/coach/sessions";
import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";

const OPTIONS = { skip: skipWithoutDatabase };

/** A conversation with `count` events, the newest carrying its index. */
function conversation(id: string, savedAt: number, count = 2): Conversation {
  return {
    id,
    title: `about ${id}`,
    savedAt,
    events: Array.from({ length: count }, (_, i) => ({
      type: "text",
      data: { index: i },
    })) as unknown as Conversation["events"],
    session: undefined,
  };
}

test("anything that is not a conversation is dropped", () => {
  const kept = sanitizeConversations([
    conversation("a", 2),
    null,
    "not a conversation",
    { id: "no events" },
    { events: [], title: "no id" },
  ]);
  assert.deepEqual(
    kept.map((c) => c.id),
    ["a"],
  );
  assert.deepEqual(sanitizeConversations("nope"), []);
  assert.deepEqual(sanitizeConversations(null), []);
});

test("the caps are applied on the way in, not trusted from the client", () => {
  const many = Array.from({ length: MAX_CONVERSATIONS + 8 }, (_, i) =>
    conversation(`c${i}`, i),
  );
  const kept = sanitizeConversations(many);
  assert.equal(kept.length, MAX_CONVERSATIONS);
  // Newest first, so the oldest are the ones that fall off.
  assert.equal(kept[0].id, `c${MAX_CONVERSATIONS + 7}`);

  const long = sanitizeConversations([conversation("long", 1, MAX_EVENTS + 50)]);
  assert.equal(long[0].events.length, MAX_EVENTS);
  // The newest run is kept, not a sample across it: `initialEvents` has to be
  // an ordered prefix of the same session or the thread will not redraw.
  const last = long[0].events.at(-1) as unknown as { data: { index: number } };
  assert.equal(last.data.index, MAX_EVENTS + 49);
});

test("AC-ACCT-004.3: the same account sees its threads on another device", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    await writeConversations(account.id, [conversation("cv", 2), conversation("visa", 1)], db);

    // The phone, reading the same row.
    const onThePhone = await readConversations(account.id, db);
    assert.deepEqual(
      onThePhone.map((c) => c.id),
      ["cv", "visa"],
      "newest first",
    );
    assert.equal(onThePhone[0].title, "about cv");
    assert.equal(onThePhone[0].events.length, 2);
  });
});

test("AC-ACCT-004.2 and 004.4: one account never sees another's threads", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const mai = await createAccount("mai@example.com", "a good long password", db);
    const nam = await createAccount("nam@example.com", "another long password", db);

    await writeConversations(mai.id, [conversation("mai-thread", 1)], db);
    await writeConversations(nam.id, [conversation("nam-thread", 1)], db);

    assert.deepEqual((await readConversations(mai.id, db)).map((c) => c.id), ["mai-thread"]);
    assert.deepEqual((await readConversations(nam.id, db)).map((c) => c.id), ["nam-thread"]);

    // And writing as one leaves the other untouched.
    await writeConversations(mai.id, [], db);
    assert.equal((await readConversations(nam.id, db)).length, 1);
  });
});

test("an account that has never talked has no threads, not an error", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    assert.deepEqual(await readConversations(account.id, db), []);
  });
});

test("a write replaces the list rather than appending to it", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    await writeConversations(account.id, [conversation("first", 1)], db);
    await writeConversations(account.id, [conversation("second", 2)], db);

    const { rows } = await db.query<{ n: string }>("select count(*) n from conversations");
    assert.equal(rows[0].n, "1", "one row per account, not a history");
    assert.deepEqual((await readConversations(account.id, db)).map((c) => c.id), ["second"]);
  });
});

test("deleting a conversation is a write of the shorter list", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    await writeConversations(account.id, [conversation("a", 2), conversation("b", 1)], db);
    await writeConversations(account.id, [conversation("a", 2)], db);
    assert.deepEqual((await readConversations(account.id, db)).map((c) => c.id), ["a"]);
  });
});

test("Vietnamese survives the round trip", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const entry = { ...conversation("vi", 1), title: "Mình nên học gì tiếp?" };
    await writeConversations(account.id, [entry], db);
    assert.equal((await readConversations(account.id, db))[0].title, "Mình nên học gì tiếp?");
  });
});

test("a row that is not a list reads as empty rather than throwing", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    await db.query("insert into conversations (account_id, list) values ($1, $2)", [
      account.id,
      JSON.stringify({ not: "a list" }),
    ]);
    assert.deepEqual(await readConversations(account.id, db), []);
  });
});

test("deleting an account takes its threads with it", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    await writeConversations(account.id, [conversation("a", 1)], db);
    await db.query("delete from accounts where id = $1", [account.id]);

    const { rows } = await db.query<{ n: string }>("select count(*) n from conversations");
    assert.equal(rows[0].n, "0");
  });
});
