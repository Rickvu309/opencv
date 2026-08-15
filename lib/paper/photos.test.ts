// A photo is the one piece of a CV that is a picture of the user's face, so
// the questions worth asking are about who can reach it and what happens when
// the template changes underneath it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { createAccount } from "@/lib/auth/accounts";
import { photoUrl, visiblePhotoUrl } from "@/lib/paper/photo-url";
import {
  MAX_PHOTO_BYTES,
  deletePhoto,
  isPhotoMime,
  readPhoto,
  writePhoto,
} from "@/lib/paper/photos";
import { templateHasPhoto, templates } from "@/lib/paper/cv";
import { skipWithoutDatabase, withMigratedSchema } from "@/lib/db/testing";

const OPTIONS = { skip: skipWithoutDatabase };

/** A CV in a state, and the state around it. */
function withCv() {
  const { state } = applyAction(seedState(), "paper.create", { type: "cv",
    label: "CV, Data Analyst",
    fromProfile: false,
  });
  return { state, id: state.paper[0].id };
}

/* ── Which templates have a photo area ──────────────────────────────────── */

test("AC-PAPERS-010.4: some templates have a photo area and some do not", () => {
  // Both halves matter. If every template had one, the international CV would
  // carry a photo into a company that screens them out; if none did, the
  // Vietnamese application would look incomplete.
  assert.ok(templates.some(templateHasPhoto), "no template offers a photo");
  assert.ok(templates.some((t) => !templateHasPhoto(t)), "every template offers one");
  assert.equal(templateHasPhoto("classic"), true, "the Vietnamese standard carries one");
});

test("switching to a template without a photo hides it rather than losing it", () => {
  const cv = withCv();
  const { id } = cv;
  let state = cv.state;
  state = applyAction(state, "paper.setPhoto", { id, stamp: "123" }).state;

  const withPhoto = state.paper[0];
  assert.ok(visiblePhotoUrl(withPhoto), "the classic template should show it");

  const international = applyAction(state, "paper.setTheme", { id, template: "modern" })
    .state.paper[0];
  assert.equal(visiblePhotoUrl(international), null, "the photo area is omitted");
  // But the photo is still attached, so switching back brings it home rather
  // than making the user upload it again.
  assert.ok(photoUrl(international), "the photo was forgotten, not just hidden");

  const back = applyAction(state, "paper.setTheme", { id, template: "classic" })
    .state.paper[0];
  assert.ok(visiblePhotoUrl(back));
});

test("a CV with no photo has no URL to fetch", () => {
  const { state } = withCv();
  assert.equal(photoUrl(state.paper[0]), null);
  assert.equal(visiblePhotoUrl(state.paper[0]), null);
});

test("replacing the photo changes the URL", () => {
  // Without this the browser keeps showing the old picture from its cache and
  // the user clicks upload again on a photo that did upload.
  const cv = withCv();
  const { id } = cv;
  let state = cv.state;
  state = applyAction(state, "paper.setPhoto", { id, stamp: "1" }).state;
  const first = photoUrl(state.paper[0]);
  state = applyAction(state, "paper.setPhoto", { id, stamp: "2" }).state;
  assert.notEqual(photoUrl(state.paper[0]), first);
});

test("removing the photo clears the stamp", () => {
  const cv = withCv();
  const { id } = cv;
  let state = cv.state;
  state = applyAction(state, "paper.setPhoto", { id, stamp: "1" }).state;
  state = applyAction(state, "paper.setPhoto", { id }).state;
  assert.equal(state.paper[0].photoStamp, undefined);
  assert.equal(photoUrl(state.paper[0]), null);
});

test("only real image types are accepted", () => {
  assert.equal(isPhotoMime("image/jpeg"), true);
  assert.equal(isPhotoMime("image/png"), true);
  // An SVG is a document that can carry script, and this renders inside the
  // app's own origin.
  assert.equal(isPhotoMime("image/svg+xml"), false);
  assert.equal(isPhotoMime("text/html"), false);
  assert.equal(isPhotoMime(undefined), false);
  assert.ok(MAX_PHOTO_BYTES > 0);
});

/* ── The store ──────────────────────────────────────────────────────────── */

const PIXEL = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

test("a photo round-trips", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    await writePhoto(account.id, "cv-1", PIXEL, "image/jpeg", db);

    const stored = await readPhoto(account.id, "cv-1", db);
    assert.ok(stored);
    assert.deepEqual(Buffer.from(stored.image), PIXEL);
    assert.equal(stored.mime, "image/jpeg");
  });
});

test("AC-PAPERS-004-style isolation: one account cannot read another's photo", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const mai = await createAccount("mai", "a good long password", db);
    const nam = await createAccount("nam", "another long password", db);
    await writePhoto(mai.id, "cv-1", PIXEL, "image/jpeg", db);

    // Same CV id, different account. This is the request an attacker makes,
    // and it has to come back empty rather than with somebody's face.
    assert.equal(await readPhoto(nam.id, "cv-1", db), null);
  });
});

test("replacing a photo leaves one row, not two", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    await writePhoto(account.id, "cv-1", PIXEL, "image/jpeg", db);
    await writePhoto(account.id, "cv-1", Buffer.from([0x89, 0x50]), "image/png", db);

    const { rows } = await db.query<{ n: string }>("select count(*) n from paper_photos");
    assert.equal(rows[0].n, "1");
    assert.equal((await readPhoto(account.id, "cv-1", db))?.mime, "image/png");
  });
});

test("two CVs on one account keep separate photos", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    await writePhoto(account.id, "cv-1", PIXEL, "image/jpeg", db);
    await writePhoto(account.id, "cv-2", Buffer.from([0x89, 0x50]), "image/png", db);

    assert.equal((await readPhoto(account.id, "cv-1", db))?.mime, "image/jpeg");
    assert.equal((await readPhoto(account.id, "cv-2", db))?.mime, "image/png");
  });
});

test("deleting is idempotent, and only takes the one asked for", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    await writePhoto(account.id, "cv-1", PIXEL, "image/jpeg", db);
    await writePhoto(account.id, "cv-2", PIXEL, "image/jpeg", db);

    await deletePhoto(account.id, "cv-1", db);
    await deletePhoto(account.id, "cv-1", db);

    assert.equal(await readPhoto(account.id, "cv-1", db), null);
    assert.ok(await readPhoto(account.id, "cv-2", db), "the other CV's photo went too");
  });
});

test("deleting an account takes its photos with it", OPTIONS, async () => {
  await withMigratedSchema(async (db) => {
    const account = await createAccount("mai", "a good long password", db);
    await writePhoto(account.id, "cv-1", PIXEL, "image/jpeg", db);

    await db.query("delete from accounts where id = $1", [account.id]);

    const { rows } = await db.query<{ n: string }>("select count(*) n from paper_photos");
    assert.equal(rows[0].n, "0", "somebody's face outlived their account");
  });
});
