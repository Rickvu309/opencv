// Persistence is the one place the app reads something it did not write this
// run, so it is the one place a corrupt or foreign value can reach the reducer.
// These tests are about surviving that, and about the line between the two
// stores: an account's row on the server, a visitor's copy in the browser.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY,
  configurePersistence,
  flushState,
  loadState,
  saveState,
} from "@/lib/actions/persistence";
import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";

/** Minimal localStorage, enough for the module under test. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
  removeItem = (k: string) => void this.map.delete(k);
  /** Make the next write fail, the way a full quota or private mode does. */
  failWrites = false;
}

/** Every request the module made, and what each was answered with. */
type Sent = { method: string; body: unknown };
let sent: Sent[] = [];
let answerWith: { ok: boolean } | "throw" = { ok: true };

function installWindow() {
  const storage = new MemoryStorage();
  const setItem = storage.setItem;
  storage.setItem = (k: string, v: string) => {
    if (storage.failWrites) throw new Error("QuotaExceededError");
    setItem(k, v);
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };

  sent = [];
  answerWith = { ok: true };
  (globalThis as { fetch?: unknown }).fetch = async (
    _url: string,
    init: { method: string; body: string },
  ) => {
    sent.push({ method: init.method, body: JSON.parse(init.body) });
    if (answerWith === "throw") throw new Error("offline");
    return { ok: answerWith.ok };
  };
  return storage;
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = installWindow();
  // Signed out unless a test says otherwise, so no test inherits the previous
  // one's answer to the only question this module keeps between calls.
  configurePersistence({ signedIn: false });
});

/** Long enough for the write queue's quiet period to pass. */
const afterTheQueue = () => new Promise((resolve) => setTimeout(resolve, 900));

/* ── Signed out: the browser, exactly as before ──────────────────────────── */

test("a round trip through the browser returns what was written", async () => {
  configurePersistence({ signedIn: false });
  const { state } = applyAction(seedState(), "profile.addCourse", {
    name: "Ôn SQL",
  });

  assert.equal(await saveState(state), true);
  const loaded = loadState();
  assert.deepEqual(loaded.profile.education.courses, ["Ôn SQL"]);
  assert.equal(sent.length, 0, "an anonymous visitor must not reach the server");
});

test("an empty store falls back to the seed", async () => {
  assert.deepEqual(loadState().papers.length, seedState().papers.length);
});

test("a corrupt blob is discarded rather than loaded", async () => {
  storage.setItem(STORAGE_KEY, "{ not json");
  assert.deepEqual(loadState().papers.length, seedState().papers.length);
  // And it is removed, or this check would fail on every load forever.
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("a value of the wrong shape is discarded", async () => {
  // Valid JSON, but not an AppState: an older schema, or someone's console.
  storage.setItem(STORAGE_KEY, JSON.stringify({ papers: "nope" }));
  assert.equal(loadState().papers.length, seedState().papers.length);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("a blob from before a field existed is filled in, not discarded", async () => {
  // The old shape: everything the reducer needs except `resumes`. Loading it
  // as-is would put `undefined` where every `resume.*` action expects an array.
  //
  // This used to be discarded, and that was right while the blob was demo
  // data. It is wrong now that the same code path reads an account's real work
  // from the server, so the missing field is filled in from the seed and
  // everything the user actually wrote is kept.
  const older: Record<string, unknown> = { ...seedState() };
  delete older.resumes;
  older.pitch = [
    { id: "p1", kind: "bio", body: "Sinh viên năm ba", language: "vi", updatedAt: 0 },
  ];
  storage.setItem(STORAGE_KEY, JSON.stringify(older));

  const loaded = loadState();
  assert.deepEqual(loaded.resumes, [], "the missing field takes the seed's value");
  assert.equal(loaded.pitch.length, 1, "the user's work survived the shape change");
  assert.equal(loaded.pitch[0].body, "Sinh viên năm ba");
});

test("a blob that is genuinely wrong is still discarded", async () => {
  // Filling in a missing key is a migration. Patching a key that holds the
  // wrong type would be hiding corruption, so this is still refused.
  const broken: Record<string, unknown> = { ...seedState(), pitch: "nope" };
  storage.setItem(STORAGE_KEY, JSON.stringify(broken));

  assert.equal(loadState().pitch.length, 0);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("a failed browser write is reported, not thrown", async () => {
  configurePersistence({ signedIn: false });
  storage.failWrites = true;
  // The app must keep working without persistence; a full quota is not a crash.
  assert.equal(await saveState(seedState()), false);
});

/* ── Signed in: the account's row ────────────────────────────────────────── */

test("the server's state wins over anything in the browser", async () => {
  // A leftover local copy from before this person signed in must never be
  // what their account shows. WO-24 is explicit that it is not carried over.
  const { state: local } = applyAction(seedState(), "profile.addCourse", { name: "somebody else's" });
  storage.setItem(STORAGE_KEY, JSON.stringify(local));

  const { state: mine } = applyAction(seedState(), "profile.addCourse", { name: "mine" });
  assert.equal(loadState(mine).profile.education.courses[0], "mine");
});

test("a signed-in save goes to the server and not to the browser", async () => {
  configurePersistence({ signedIn: true });
  const { state } = applyAction(seedState(), "profile.addCourse", {
    name: "Ôn SQL",
  });

  assert.equal(await saveState(state), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, "PUT");
  assert.equal(
    (sent[0].body as { state: { profile: { education: { courses: string[] } } } })
      .state.profile.education.courses[0],
    "Ôn SQL",
  );
  assert.equal(storage.getItem(STORAGE_KEY), null, "the account's work is not left in the browser");
});

test("a burst of dispatches becomes one request carrying the last state", async () => {
  configurePersistence({ signedIn: true });

  // Onboarding commits eight actions in one tick, and typing a CV line
  // dispatches per keystroke. A request each would be slow and pointless: only
  // the last one's contents survive anyway.
  let state = seedState();
  const answers: Promise<boolean>[] = [];
  for (const name of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    state = applyAction(state, "profile.addCourse", { name }).state;
    answers.push(saveState(state));
  }
  await Promise.all(answers);

  assert.equal(sent.length, 1, `expected one request, got ${sent.length}`);
  const written = (
    sent[0].body as { state: { profile: { education: { courses: string[] } } } }
  ).state;
  const courses = written.profile.education.courses;
  assert.equal(courses.length, 8, "the request must carry every change, not just the last");
  assert.deepEqual([...courses].sort(), ["A", "B", "C", "D", "E", "F", "G", "H"]);
});

test("a save that did not land is reported as false", async () => {
  configurePersistence({ signedIn: true });

  answerWith = { ok: false };
  assert.equal(await saveState(seedState()), false, "a 500 must not read as saved");

  answerWith = "throw";
  assert.equal(await saveState(seedState()), false, "being offline must not read as saved");
});

test("a later save still lands after an earlier one failed", async () => {
  configurePersistence({ signedIn: true });

  answerWith = "throw";
  assert.equal(await saveState(seedState()), false);
  // The queue must not be wedged by a failure: the network comes back and the
  // next change has to reach the server, or the user silently stops saving.
  answerWith = { ok: true };
  assert.equal(await saveState(seedState()), true);
});

test("a change made while a request is in flight is sent afterwards", async () => {
  configurePersistence({ signedIn: true });

  const first = applyAction(seedState(), "profile.addCourse", { name: "first" }).state;
  const answer = saveState(first);
  await afterTheQueue();

  // Two requests must never overlap, or the older state could land last, which
  // is the one failure a last-write-wins store cannot tolerate.
  const second = applyAction(first, "profile.addCourse", { name: "second" }).state;
  const later = saveState(second);
  await answer;
  await later;

  assert.equal(sent.length, 2);
  const last = (
    sent[1].body as { state: { profile: { education: { courses: string[] } } } }
  ).state;
  assert.equal(last.profile.education.courses.includes("second"), true);
});

test("the tab flushing on its way out sends a beacon", async (t) => {
  configurePersistence({ signedIn: true });

  const beacons: unknown[] = [];
  // `globalThis.navigator` is a getter in Node, so it is defined over rather
  // than assigned to.
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      sendBeacon: (_url: string, blob: unknown) => {
        beacons.push(blob);
        return true;
      },
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "navigator", original);
  });

  // Queued, and the quiet period has not passed: without the flush this is the
  // work somebody loses every time they close the tab.
  void saveState(
    applyAction(seedState(), "profile.addCourse", { name: "unsaved" }).state,
  );
  flushState();

  assert.equal(beacons.length, 1);
  assert.equal(sent.length, 0, "the beacon replaces the request rather than adding one");
});
