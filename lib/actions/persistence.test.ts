// Storage is the one place the app reads something it did not write this run,
// so it is the one place a corrupt or foreign value can reach the reducer.
// These tests are about surviving that, not about localStorage working.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

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

function installWindow() {
  const storage = new MemoryStorage();
  const setItem = storage.setItem;
  storage.setItem = (k: string, v: string) => {
    if (storage.failWrites) throw new Error("QuotaExceededError");
    setItem(k, v);
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  return storage;
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = installWindow();
});

/** Imported lazily so each test sees the window installed above. */
async function persistence() {
  return await import("@/lib/actions/persistence");
}

test("a round trip returns what was written", async () => {
  const { loadState, saveState } = await persistence();
  const { state } = applyAction(seedState(), "todo.add", { title: "Ôn SQL" });

  assert.equal(saveState(state), true);
  const loaded = loadState();
  assert.equal(loaded.todos.length, state.todos.length);
  assert.equal(loaded.todos[0].title, "Ôn SQL");
});

test("an empty store falls back to the seed", async () => {
  const { loadState } = await persistence();
  assert.deepEqual(loadState().todos.length, seedState().todos.length);
});

test("a corrupt blob is discarded rather than loaded", async () => {
  const { loadState, STORAGE_KEY } = await persistence();
  storage.setItem(STORAGE_KEY, "{ not json");
  assert.deepEqual(loadState().todos.length, seedState().todos.length);
  // And it is removed, or this check would fail on every load forever.
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("a value of the wrong shape is discarded", async () => {
  const { loadState, STORAGE_KEY } = await persistence();
  // Valid JSON, but not an AppState: an older schema, or someone's console.
  storage.setItem(STORAGE_KEY, JSON.stringify({ todos: "nope" }));
  assert.equal(loadState().todos.length, seedState().todos.length);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("a blob from before CVs existed is discarded, not half-loaded", async () => {
  const { loadState, STORAGE_KEY } = await persistence();
  // The v1 shape: everything the reducer needs except `resumes`. Loading it
  // would put `undefined` where every `resume.*` action expects an array, and
  // the CV screen would throw on its first read rather than on a write.
  const v1: Record<string, unknown> = { ...seedState() };
  delete v1.resumes;
  storage.setItem(STORAGE_KEY, JSON.stringify(v1));

  assert.deepEqual(loadState().resumes, [], "a discarded blob reseeds");
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("a failed write is reported, not thrown", async () => {
  const { saveState } = await persistence();
  storage.failWrites = true;
  // The app must keep working without persistence; a full quota is not a crash.
  assert.equal(saveState(seedState()), false);
});

test("onboarding's eight actions in one tick each build on the last", async () => {
  const { loadState, saveState } = await persistence();
  // The ticket asks to check this rather than assume it. Sequential dispatches
  // must compose, so the eighth write contains the first seven's changes.
  let state = seedState();
  for (const title of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    state = applyAction(state, "todo.add", { title }).state;
    saveState(state);
  }
  const loaded = loadState();
  const titles = loaded.todos.map((t) => t.title);
  for (const title of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    assert.ok(titles.includes(title), `${title} was lost`);
  }
});
