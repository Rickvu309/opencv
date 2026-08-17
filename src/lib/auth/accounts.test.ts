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
  handleFromEmail,
  verifyCredentials,
} from "@/lib/auth/accounts";
import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";

const OPTIONS = { skip: skipWithoutDatabase };

const PASSWORD = "a good long password";

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

test("the handle is the local part, never the address", () => {
  assert.equal(handleFromEmail("mai@example.com"), "mai");
  assert.equal(handleFromEmail("mai.anh+tag@example.com"), "mai.anhtag");
  assert.equal(handleFromEmail("@@@"), "user");
});

test("AC-ACCT-001.1: an email and password make an account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", PASSWORD, db);
    assert.equal(account.email, "mai@example.com");
    assert.equal(account.username, "mai");
    assert.ok(account.id, "an account has an id to hang state from");
    assert.ok(account.createdAt instanceof Date);

    const again = await accountById(account.id, db);
    assert.equal(again?.email, "mai@example.com");
    assert.equal(again?.username, "mai");
  });
});

test("AC-ACCT-001.2: a taken email is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    await createAccount("mai@example.com", PASSWORD, db);
    assert.equal(
      await problem(() => createAccount("mai@example.com", "a different password", db)),
      "email-taken",
    );
    assert.equal(
      await problem(() => createAccount("MAI@example.com", "a different password", db)),
      "email-taken",
    );
  });
});

test("two addresses that share a local part still both get an account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const first = await createAccount("mai@example.com", PASSWORD, db);
    const second = await createAccount("mai@other.com", PASSWORD, db);
    assert.equal(first.username, "mai");
    assert.equal(second.username, "mai-2");
    assert.notEqual(first.id, second.id);
  });
});

test("AC-ACCT-001.3: an empty field is named, not lumped together", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    assert.equal(await problem(() => createAccount("", PASSWORD, db)), "email-required");
    assert.equal(await problem(() => createAccount("   ", PASSWORD, db)), "email-required");
    assert.equal(await problem(() => createAccount("mai", PASSWORD, db)), "email-shape");
    assert.equal(await problem(() => createAccount("mai@example.com", "", db)), "password-required");
    assert.equal(await problem(() => createAccount(undefined, PASSWORD, db)), "email-required");
    assert.equal(await problem(() => createAccount("mai@example.com", undefined, db)), "password-required");
    assert.equal(
      await problem(() => createAccount("mai@example.com", PASSWORD, db, "")),
      "confirm-required",
    );
    assert.equal(
      await problem(() => createAccount("mai@example.com", PASSWORD, db, "something else")),
      "password-mismatch",
    );
  });
});

test("AC-ACCT-001.4: the password is stored only as a hash", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const password = "một mật khẩu dài";
    const account = await createAccount("mai@example.com", password, db);

    const { rows } = await db.query<{ password_hash: string }>(
      "select password_hash from accounts where id = $1",
      [account.id],
    );
    const stored = rows[0].password_hash;

    assert.notEqual(stored, password, "the password is in the table in plain text");
    assert.ok(!stored.includes(password), "the password is inside the stored value");
    assert.match(stored, /^\$2[aby]\$\d\d\$/, "not a bcrypt hash");
    assert.ok(await bcrypt.compare(password, stored), "the hash does not verify");

    assert.equal("passwordHash" in account, false);
    assert.equal("password" in account, false);
  });
});

test("the same password twice produces different hashes", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    await createAccount("mai@example.com", PASSWORD, db);
    await createAccount("nam@example.com", PASSWORD, db);
    const { rows } = await db.query<{ password_hash: string }>(
      "select password_hash from accounts order by username",
    );
    assert.notEqual(rows[0].password_hash, rows[1].password_hash);
  });
});

test("a password too short to be worth anything is refused", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    assert.equal(
      await problem(() => createAccount("mai@example.com", "short", db)),
      "password-too-short",
    );
  });
});

test("a password past bcrypt's limit is refused rather than silently cut", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    assert.equal(
      await problem(() => createAccount("mai@example.com", "x".repeat(100), db)),
      "password-too-short",
    );
  });
});

test("AC-ACCT-002.1: the right pair returns the account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const created = await createAccount("mai@example.com", PASSWORD, db);
    const signedIn = await verifyCredentials("mai@example.com", PASSWORD, db);
    assert.equal(signedIn.id, created.id);
  });
});

test("the email is not case sensitive at sign-in", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const created = await createAccount("Mai@example.com", PASSWORD, db);
    for (const spelling of ["mai@example.com", "MAI@EXAMPLE.COM", "  Mai@example.com  "]) {
      const signedIn = await verifyCredentials(spelling, PASSWORD, db);
      assert.equal(signedIn.id, created.id, `${JSON.stringify(spelling)} failed`);
    }
  });
});

test("an old username still opens the account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const created = await createAccount("mai@example.com", PASSWORD, db);
    const signedIn = await verifyCredentials("mai", PASSWORD, db);
    assert.equal(signedIn.id, created.id);
  });
});

test("AC-ACCT-002.2: a wrong password and an unknown user are the same refusal", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    await createAccount("mai@example.com", PASSWORD, db);

    const wrongPassword = await problem(() =>
      verifyCredentials("mai@example.com", "not the password", db),
    );
    const noSuchUser = await problem(() =>
      verifyCredentials("nobody@example.com", "not the password", db),
    );
    const emptyBoth = await problem(() => verifyCredentials("", "", db));

    assert.equal(wrongPassword, "bad-credentials");
    assert.equal(noSuchUser, wrongPassword, "the answers differ, so emails can be discovered");
    assert.equal(emptyBoth, wrongPassword);
  });
});

test("an unknown email still costs a hash comparison", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    await createAccount("mai@example.com", PASSWORD, db);

    const time = async (user: string) => {
      const started = process.hrtime.bigint();
      await problem(() => verifyCredentials(user, "not the password", db));
      return Number(process.hrtime.bigint() - started) / 1e6;
    };

    const unknown = await time("nobody@example.com");
    const known = await time("mai@example.com");
    assert.ok(
      unknown > known / 4,
      `unknown user answered in ${unknown.toFixed(1)}ms against ${known.toFixed(1)}ms for a real one`,
    );
  });
});

test("a deleted account cannot be looked up", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai@example.com", PASSWORD, db);
    await db.query("delete from accounts where id = $1", [account.id]);
    assert.equal(await accountById(account.id, db), null);
  });
});
