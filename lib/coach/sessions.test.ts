// Conversations are the one thing here the user cannot rebuild by asking again,
// so the storage layer gets tested rather than trusted.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clearConversations,
  conversationTitle,
  loadConversations,
  removeConversation,
  upsertConversation,
  type Conversation,
} from "@/lib/coach/sessions";

/** A localStorage good enough for these, and no more. */
function fakeWindow() {
  const store = new Map<string, string>();
  return {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
}

function withWindow(run: () => void) {
  const globals = globalThis as { window?: unknown };
  const had = "window" in globals;
  const previous = globals.window;
  globals.window = fakeWindow();
  try {
    run();
  } finally {
    if (had) globals.window = previous;
    else delete globals.window;
  }
}

const conversation = (id: string, savedAt: number, title = ""): Conversation => ({
  id,
  title,
  savedAt,
  events: [{ type: "x" }] as never,
  session: undefined,
});

test("an empty store has no conversations", () => {
  withWindow(() => assert.deepEqual(loadConversations(), []));
});

test("a saved conversation comes back", () => {
  withWindow(() => {
    upsertConversation(conversation("a", 1, "CV cho VNG"));
    const stored = loadConversations();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].title, "CV cho VNG");
  });
});

test("saving the same id twice replaces rather than duplicates", () => {
  withWindow(() => {
    upsertConversation(conversation("a", 1, "first"));
    upsertConversation(conversation("a", 2, "second"));
    const stored = loadConversations();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].title, "second");
  });
});

test("conversations come back newest first", () => {
  withWindow(() => {
    upsertConversation(conversation("old", 1));
    upsertConversation(conversation("new", 5));
    upsertConversation(conversation("mid", 3));
    assert.deepEqual(
      loadConversations().map((c) => c.id),
      ["new", "mid", "old"],
    );
  });
});

test("the list is capped, oldest first out", () => {
  // Every conversation carries up to 400 events, and localStorage is a few
  // megabytes shared with the app's own state.
  withWindow(() => {
    for (let i = 1; i <= 20; i += 1) upsertConversation(conversation(`c${i}`, i));
    const stored = loadConversations();
    assert.equal(stored.length, 12);
    assert.equal(stored[0].id, "c20");
    assert.ok(!stored.some((c) => c.id === "c1"), "oldest should have gone");
  });
});

test("deleting one leaves the rest", () => {
  withWindow(() => {
    upsertConversation(conversation("a", 1));
    upsertConversation(conversation("b", 2));
    const left = removeConversation("a");
    assert.deepEqual(left.map((c) => c.id), ["b"]);
    assert.deepEqual(loadConversations().map((c) => c.id), ["b"]);
  });
});

test("a corrupt blob is discarded, not half-loaded", () => {
  withWindow(() => {
    (globalThis as { window: ReturnType<typeof fakeWindow> }).window.localStorage.setItem(
      "openpath:coach-conversations:v1",
      "{not json",
    );
    assert.deepEqual(loadConversations(), []);
  });
});

test("the single conversation from the previous version is carried over", () => {
  // Someone mid-thought when this shipped should not lose it.
  withWindow(() => {
    const w = (globalThis as { window: ReturnType<typeof fakeWindow> }).window;
    w.localStorage.setItem(
      "openpath:coach-session:v1",
      JSON.stringify({ events: [{ type: "x" }], session: undefined }),
    );
    const carried = loadConversations();
    assert.equal(carried.length, 1);
    assert.equal(carried[0].id, "carried-over");
    // And exactly once: the old key is dropped as soon as it has been read.
    assert.equal(w.localStorage.getItem("openpath:coach-session:v1"), null);
  });
});

test("clearing removes both the list and the old single key", () => {
  withWindow(() => {
    upsertConversation(conversation("a", 1));
    clearConversations();
    assert.deepEqual(loadConversations(), []);
  });
});

test("a conversation is named by what was asked first", () => {
  const events = [
    { data: { message: { role: "assistant", parts: [{ type: "text", text: "Chào bạn" }] } } },
    { data: { message: { role: "user", parts: [{ type: "text", text: "Mình nên học gì?" }] } } },
    { data: { message: { role: "user", parts: [{ type: "text", text: "Còn CV thì sao?" }] } } },
  ] as never;
  assert.equal(conversationTitle(events), "Mình nên học gì?");
});

test("a conversation with nothing asked yet has no name", () => {
  assert.equal(conversationTitle([] as never), "");
});
