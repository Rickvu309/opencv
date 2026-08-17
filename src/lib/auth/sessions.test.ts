// REQ-ACCT-002.3 and REQ-ACCT-003: a session that lasts, and a sign-out that
// actually shuts the door rather than only the browser's copy of it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createAccount } from "@/lib/auth/accounts";
import { tokenHash } from "@/lib/auth/cookie";
import {
  SESSION_DAYS,
  SESSION_HOURS_TRANSIENT,
  endAllSessions,
  endSession,
  readSession,
  startSession,
  sweepExpiredSessions,
} from "@/lib/auth/sessions";
import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";

const OPTIONS = { skip: skipWithoutDatabase };

test("AC-ACCT-002.1: a session resolves to its account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const session = await startSession(account.id, db);

    const found = await readSession(session.token, db);
    assert.equal(found?.id, account.id);
    assert.equal(found?.username, "mai");
  });
});

test("AC-ACCT-002.3: the session survives being read again and again", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const session = await startSession(account.id, db);

    // A reload is nothing more than another read with the same cookie. Three
    // of them, because "works once" is not the property being claimed.
    for (let i = 0; i < 3; i += 1) {
      assert.equal((await readSession(session.token, db))?.id, account.id);
    }
    assert.equal(session.persistent, true);
    assert.ok(
      session.expiresAt.getTime() > Date.now() + (SESSION_DAYS - 1) * 86_400_000,
      "the session should last about a month",
    );
  });
});

test("without remember me the session dies with the browser", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const now = new Date();
    const session = await startSession(account.id, db, now, false);

    assert.equal(session.persistent, false);
    const ms = session.expiresAt.getTime() - now.getTime();
    assert.ok(
      ms <= SESSION_HOURS_TRANSIENT * 60 * 60 * 1000,
      "an unchecked box must not last a month",
    );
    assert.equal((await readSession(session.token, db))?.id, account.id);
  });
});

test("the token is never what the table stores", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const session = await startSession(account.id, db);

    const { rows } = await db.query<{ id: string }>("select id from sessions");
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].id, session.token, "a dump of this table would be a set of keys");
    assert.equal(rows[0].id, tokenHash(session.token));
  });
});

test("an expired session is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const session = await startSession(account.id, db);

    // Expiry is enforced by the database's clock, not the application's, so a
    // machine with a wrong clock cannot extend anybody's session.
    await db.query("update sessions set expires_at = now() - interval '1 second'");
    assert.equal(await readSession(session.token, db), null);
  });
});

test("AC-ACCT-003.1 and 003.2: sign-out ends the session everywhere", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const session = await startSession(account.id, db);

    await endSession(session.token, db);

    // The row is gone, so the cookie is worthless even to a copy of it that
    // never learned about the sign-out. This is the reason the session is a
    // row and not a self-contained cookie.
    assert.equal(await readSession(session.token, db), null);
    const { rows } = await db.query("select 1 from sessions");
    assert.equal(rows.length, 0);
  });
});

test("signing out twice is not an error", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const session = await startSession(account.id, db);
    await endSession(session.token, db);
    await endSession(session.token, db);
    await endSession(null, db);
  });
});

test("one device signing out leaves the other signed in", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const laptop = await startSession(account.id, db);
    const phone = await startSession(account.id, db);

    await endSession(laptop.token, db);

    assert.equal(await readSession(laptop.token, db), null);
    assert.equal((await readSession(phone.token, db))?.id, account.id, "the phone was signed out too");
  });
});

test("every session on an account can be ended at once", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const laptop = await startSession(account.id, db);
    const phone = await startSession(account.id, db);

    await endAllSessions(account.id, db);

    assert.equal(await readSession(laptop.token, db), null);
    assert.equal(await readSession(phone.token, db), null);
  });
});

test("one account's session never resolves to another account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const mai = await createAccount("mai@example.com", "a good long password", db);
    const nam = await createAccount("nam@example.com", "another long password", db);
    const maiSession = await startSession(mai.id, db);
    const namSession = await startSession(nam.id, db);

    assert.equal((await readSession(maiSession.token, db))?.id, mai.id);
    assert.equal((await readSession(namSession.token, db))?.id, nam.id);
  });
});

test("a token nobody issued resolves to nobody", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    await createAccount("mai@example.com", "a good long password", db);
    assert.equal(await readSession("a token that was never issued", db), null);
    assert.equal(await readSession(null, db), null);
    assert.equal(await readSession("", db), null);
  });
});

test("deleting an account closes its sessions", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const session = await startSession(account.id, db);

    await db.query("delete from accounts where id = $1", [account.id]);
    assert.equal(await readSession(session.token, db), null);
  });
});

test("the sweep removes expired rows and leaves live ones", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", "a good long password", db);
    const live = await startSession(account.id, db);
    const dead = await startSession(account.id, db);
    await db.query("update sessions set expires_at = now() - interval '1 day' where id = $1", [
      tokenHash(dead.token),
    ]);

    assert.equal(await sweepExpiredSessions(db), 1);
    assert.equal((await readSession(live.token, db))?.id, account.id);
  });
});
