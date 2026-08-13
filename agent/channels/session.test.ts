// The agent's door. These tests are about who it opens for, which is now a
// real account rather than one shared password, and about it staying shut on
// every input that is not one.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createAccount } from "../../lib/auth/accounts";
import { SESSION_COOKIE, readSessionCookie, signToken } from "../../lib/auth/cookie";
import { startSession } from "../../lib/auth/sessions";
import { skipWithoutDatabase, withMigratedSchema } from "../../lib/db/testing";
import { userSession } from "./session";

const OPTIONS = { skip: skipWithoutDatabase };

/** A request carrying whatever cookie value is given, or none. */
function request(cookie?: string): Request {
  return new Request("https://openpath.app/eve/v1/session/x/stream", {
    headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {},
  });
}

test("the session cookie is found among others, and not confused with them", () => {
  assert.equal(readSessionCookie(`${SESSION_COOKIE}=abc`), "abc");
  assert.equal(readSessionCookie(`other=1; ${SESSION_COOKIE}=abc; last=2`), "abc");
  // A cookie whose name merely ends with ours must not be read as ours.
  assert.equal(readSessionCookie(`not_${SESSION_COOKIE}=abc`), undefined);
  assert.equal(readSessionCookie("other=1"), undefined);
  assert.equal(readSessionCookie(null), undefined);
  assert.equal(readSessionCookie(""), undefined);
});

test("a signed-in user's turn is authorized, as themselves", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const session = await startSession(account.id, db);

    const auth = await userSession(db)(request(signToken(session.token)));

    assert.ok(auth, "a live session was refused");
    // The principal is the account, not a shared demo identity. This is the
    // whole point of the migration: the turn knows who is asking.
    assert.equal(auth.principalId, account.id);
    assert.equal(auth.principalType, "user");
    assert.equal(auth.subject, "mai");
  });
});

test("no cookie is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    assert.equal(await userSession(db)(request()), null);
  });
});

test("a cookie we did not sign is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const session = await startSession(account.id, db);

    // The token is real. The signature is not, which is the case the signature
    // exists for: an attacker who guessed a session id still cannot use it.
    assert.equal(await userSession(db)(request(`${session.token}.forged`)), null);
    assert.equal(await userSession(db)(request(session.token)), null, "unsigned");
    assert.equal(await userSession(db)(request("nonsense")), null);
  });
});

test("a signed cookie for a session that has ended is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const session = await startSession(account.id, db);
    const cookie = signToken(session.token);

    // It works, and then the user signs out somewhere else.
    assert.ok(await userSession(db)(request(cookie)));
    await db.query("delete from sessions");
    assert.equal(await userSession(db)(request(cookie)), null);
  });
});

test("an expired session is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const session = await startSession(account.id, db);
    await db.query("update sessions set expires_at = now() - interval '1 second'");

    assert.equal(await userSession(db)(request(signToken(session.token))), null);
  });
});

test("a missing secret shuts the door rather than opening it", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const session = await startSession(account.id, db);
    const cookie = signToken(session.token);

    const previous = process.env.SESSION_SECRET;
    try {
      delete process.env.SESSION_SECRET;
      // An agent that opened itself because it could not check would be worse
      // than one that is briefly shut, and the bill would arrive in model
      // tokens.
      assert.equal(await userSession(db)(request(cookie)), null);
    } finally {
      if (previous === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previous;
    }
  });
});
