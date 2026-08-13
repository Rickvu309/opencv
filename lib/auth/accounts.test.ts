// The acceptance criteria of REQ-ACCT-001 and REQ-ACCT-002, against a real
// Postgres, because half of what is being asserted is enforced by the database
// and a stand-in would only test the stand-in.

import { test } from "node:test";
import assert from "node:assert/strict";

import bcrypt from "bcryptjs";

import {
  AccountError,
  accountById,
  createAccount,
  verifyCredentials,
} from "@/lib/auth/accounts";
import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";

const OPTIONS = { skip: skipWithoutDatabase };

/** What the failure was, without the try/catch at every call site. */
async function problem(body: () => Promise<unknown>): Promise<string> {
  try {
    await body();
  } catch (error) {
    if (error instanceof AccountError) return error.code;
    throw error;
  }
  throw new Error("expected a failure, got a success");
}

test("AC-ACCT-001.1: a username and password make an account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    assert.equal(account.username, "mai");
    assert.ok(account.id, "an account has an id to hang state from");
    assert.ok(account.createdAt instanceof Date);

    // And it is the same account when looked up again.
    const again = await accountById(account.id, db);
    assert.equal(again?.username, "mai");
  });
});

test("AC-ACCT-001.2: a taken username is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    await createAccount("mai", "a good long password", db);
    assert.equal(
      await problem(() => createAccount("mai", "a different password", db)),
      "username-taken",
    );
    // And in another case, because "Mai" and "mai" are one person to everyone
    // except a byte comparison.
    assert.equal(
      await problem(() => createAccount("MAI", "a different password", db)),
      "username-taken",
    );
  });
});

test("AC-ACCT-001.3: an empty field is named, not lumped together", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    assert.equal(await problem(() => createAccount("", "a good long password", db)), "username-required");
    assert.equal(await problem(() => createAccount("   ", "a good long password", db)), "username-required");
    assert.equal(await problem(() => createAccount("mai", "", db)), "password-required");
    // A missing field is the same as an empty one; the client may send either.
    assert.equal(await problem(() => createAccount(undefined, "a good long password", db)), "username-required");
    assert.equal(await problem(() => createAccount("mai", undefined, db)), "password-required");
  });
});

test("AC-ACCT-001.4: the password is stored only as a hash", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const password = "một mật khẩu dài";
    const account = await createAccount("mai", password, db);

    const { rows } = await db.query<{ password_hash: string }>(
      "select password_hash from accounts where id = $1",
      [account.id],
    );
    const stored = rows[0].password_hash;

    assert.notEqual(stored, password, "the password is in the table in plain text");
    assert.ok(!stored.includes(password), "the password is inside the stored value");
    assert.match(stored, /^\$2[aby]\$\d\d\$/, "not a bcrypt hash");
    assert.ok(await bcrypt.compare(password, stored), "the hash does not verify");

    // Nothing that returns an account carries the hash out of this module.
    assert.equal("passwordHash" in account, false);
    assert.equal("password" in account, false);
  });
});

test("the same password twice produces different hashes", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    // bcrypt salts each hash. Without that, two accounts with the same password
    // would be visibly identical in a leaked table, and cracking one would
    // crack every account that shares it.
    await createAccount("mai", "a good long password", db);
    await createAccount("nam", "a good long password", db);
    const { rows } = await db.query<{ password_hash: string }>(
      "select password_hash from accounts order by username",
    );
    assert.notEqual(rows[0].password_hash, rows[1].password_hash);
  });
});

test("a password too short to be worth anything is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    assert.equal(await problem(() => createAccount("mai", "short", db)), "password-too-short");
  });
});

test("a password past bcrypt's limit is refused rather than silently cut", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    // bcrypt ignores everything after 72 bytes. Truncating would mean two
    // different passphrases both open the account, and neither owner told.
    assert.equal(
      await problem(() => createAccount("mai", "x".repeat(100), db)),
      "password-too-short",
    );
  });
});

test("AC-ACCT-002.1: the right pair returns the account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const created = await createAccount("mai", "a good long password", db);
    const signedIn = await verifyCredentials("mai", "a good long password", db);
    assert.equal(signedIn.id, created.id);
  });
});

test("the username is not case sensitive at sign-in", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const created = await createAccount("Mai", "a good long password", db);
    // Somebody who typed a capital when they registered should not be locked
    // out by a phone that did not.
    for (const spelling of ["mai", "MAI", "  Mai  "]) {
      const signedIn = await verifyCredentials(spelling, "a good long password", db);
      assert.equal(signedIn.id, created.id, `${JSON.stringify(spelling)} failed`);
    }
  });
});

test("AC-ACCT-002.2: a wrong password and an unknown user are the same refusal", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    await createAccount("mai", "a good long password", db);

    const wrongPassword = await problem(() => verifyCredentials("mai", "not the password", db));
    const noSuchUser = await problem(() => verifyCredentials("nobody", "not the password", db));
    const emptyBoth = await problem(() => verifyCredentials("", "", db));

    assert.equal(wrongPassword, "bad-credentials");
    assert.equal(noSuchUser, wrongPassword, "the answers differ, so usernames can be discovered");
    assert.equal(emptyBoth, wrongPassword);
  });
});

test("an unknown username still costs a hash comparison", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    await createAccount("mai", "a good long password", db);

    // Timing is the side door around AC-ACCT-002.2: if an unknown username
    // answers in a millisecond and a real one takes sixty, the form itself
    // tells anyone patient which usernames exist. Measured loosely on purpose,
    // this asserts the decoy comparison happens at all, not a precise budget.
    const time = async (user: string) => {
      const started = process.hrtime.bigint();
      await problem(() => verifyCredentials(user, "not the password", db));
      return Number(process.hrtime.bigint() - started) / 1e6;
    };

    const unknown = await time("nobody-at-all");
    const known = await time("mai");
    assert.ok(
      unknown > known / 4,
      `unknown user answered in ${unknown.toFixed(1)}ms against ${known.toFixed(1)}ms for a real one`,
    );
  });
});

test("a deleted account cannot be looked up", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    await db.query("delete from accounts where id = $1", [account.id]);
    assert.equal(await accountById(account.id, db), null);
  });
});
