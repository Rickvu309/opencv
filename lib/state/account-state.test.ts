// REQ-ACCT-004: one account's work is theirs, on the server, and never
// reachable from another account. Against a real Postgres, because the
// isolation being claimed is partly the database's foreign keys.

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { createAccount } from "@/lib/auth/accounts";
import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";
import {
  createAccountState,
  loadAccountState,
  looksLikeState,
  readAccountState,
  writeAccountState,
} from "@/lib/state/account-state";

const OPTIONS = { skip: skipWithoutDatabase };

test("looksLikeState refuses what is not an AppState", () => {
  assert.equal(looksLikeState(seedState()), true);
  for (const value of [null, undefined, 1, "state", [], {}, { locale: "fr" }]) {
    assert.equal(looksLikeState(value), false, `${JSON.stringify(value)} got through`);
  }
  const missingResumes: Record<string, unknown> = { ...seedState() };
  delete missingResumes.resumes;
  assert.equal(looksLikeState(missingResumes), false);
});

test("AC-ACCT-001.5: a new account has state from the moment it exists", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const state = await createAccountState(account.id, "en", db);

    assert.equal(state.locale, "en", "the browser's language seeds the account");
    // And it is really in the table, not only in the return value.
    const stored = await readAccountState(account.id, db);
    assert.deepEqual(stored, state);
  });
});

test("a new account starts empty, and not as somebody else", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const state = await createAccountState(account.id, "vi", db);

    // There was a seeded demo persona here once and every screen read her
    // instead of the person signed in. WO-24 says in as many words not to
    // bring her back.
    assert.deepEqual(state.resumes, []);
    assert.deepEqual(state.papers, []);
    assert.deepEqual(state.pitch, []);
    assert.deepEqual(state.profile.documents, []);
    assert.equal(state.profile.identity.name, "");
    assert.equal(state.profile.identity.targetRole, "");
  });
});

test("AC-ACCT-004.1: state is stored under the account", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const { state } = applyAction(seedState(), "profile.addCourse", {
      name: "Ôn SQL",
    });
    await writeAccountState(account.id, state, db);

    const { rows } = await db.query<{ account_id: string }>("select account_id from app_state");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].account_id, account.id);
  });
});

test("AC-ACCT-004.3: the same account on another device sees the same work", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    await createAccountState(account.id, "vi", db);

    // The laptop writes.
    const { state } = applyAction(seedState(), "profile.addCourse", {
      name: "Nộp CV",
    });
    await writeAccountState(account.id, state, db);

    // The phone reads. There is one row and it is the same one, which is the
    // whole reason this moved off the browser.
    const onThePhone = await loadAccountState(account.id, db);
    assert.deepEqual(onThePhone.profile.education.courses, ["Nộp CV"]);
  });
});

test("AC-ACCT-004.2 and 004.4: one account never sees another's state", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const mai = await createAccount("mai", "a good long password", db);
    const nam = await createAccount("nam", "another long password", db);

    const withCourse = (name: string) =>
      applyAction(seedState(), "profile.addCourse", { name }).state;
    const courses = async (id: string) =>
      (await loadAccountState(id, db)).profile.education.courses;

    await writeAccountState(mai.id, withCourse("mai's"), db);
    await writeAccountState(nam.id, withCourse("nam's"), db);

    assert.deepEqual(await courses(mai.id), ["mai's"]);
    assert.deepEqual(await courses(nam.id), ["nam's"]);

    // And writing as one leaves the other exactly as it was.
    await writeAccountState(mai.id, withCourse("mai's again"), db);
    assert.deepEqual(await courses(nam.id), ["nam's"]);
  });
});

test("a write replaces the row rather than adding one", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);

    let state = seedState();
    for (const name of ["A", "B", "C"]) {
      state = applyAction(state, "profile.addCourse", { name }).state;
      await writeAccountState(account.id, state, db);
    }

    const { rows } = await db.query<{ n: string }>("select count(*) n from app_state");
    assert.equal(rows[0].n, "1", "last-write-wins means one row, not a history");
    assert.equal(
      (await loadAccountState(account.id, db)).profile.education.courses.length,
      3,
    );
  });
});

test("an account that has written nothing reads as the seed, not as an error", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    assert.equal(await readAccountState(account.id, db), null, "nothing stored yet");
    assert.deepEqual(await loadAccountState(account.id, db), seedState());
  });
});

test("a row of the wrong shape is left alone, never deleted", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    // The browser discarded a blob it could not read, because the cost was a
    // reseed of demo data. This row is somebody's real work: it stays where it
    // is, available for a migration to repair, and the app renders the seed
    // rather than refusing to load.
    await db.query("insert into app_state (account_id, state) values ($1, $2)", [
      account.id,
      JSON.stringify({ todos: "not a state" }),
    ]);

    assert.equal(await readAccountState(account.id, db), null);
    assert.deepEqual(await loadAccountState(account.id, db), seedState());

    const { rows } = await db.query<{ n: string }>("select count(*) n from app_state");
    assert.equal(rows[0].n, "1", "the unreadable row was deleted; it must not be");
  });
});

test("the state survives a round trip with Vietnamese text intact", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    const { state } = applyAction(seedState(), "profile.addCourse", {
      name: "Ôn lại SQL và viết CV tiếng Việt",
    });
    await writeAccountState(account.id, state, db);

    const back = await loadAccountState(account.id, db);
    assert.deepEqual(back.profile.education.courses, [
      "Ôn lại SQL và viết CV tiếng Việt",
    ]);
  });
});

test("deleting an account takes its state with it", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    await createAccountState(account.id, "vi", db);

    await db.query("delete from accounts where id = $1", [account.id]);

    const { rows } = await db.query<{ n: string }>("select count(*) n from app_state");
    assert.equal(rows[0].n, "0");
  });
});
