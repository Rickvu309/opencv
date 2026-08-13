// Conversations are the one thing here the user cannot rebuild by asking again,
// so the storage layer gets tested rather than trusted.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clearConversations,
  configureConversations,
  conversationTitle,
  flushConversations,
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

/* ── Signed in: the account's row, not this browser ──────────────────────── */

/** Every request the module made, so the queue can be watched. */
function withServer(
  run: (sent: { body: unknown }[]) => Promise<void>,
): () => Promise<void> {
  return async () => {
    const globals = globalThis as { window?: unknown; fetch?: unknown };
    const hadWindow = "window" in globals;
    const previousWindow = globals.window;
    const previousFetch = globals.fetch;

    const sent: { body: unknown }[] = [];
    globals.window = fakeWindow();
    globals.fetch = async (_url: string, init: { body: string }) => {
      sent.push({ body: JSON.parse(init.body) });
      return { ok: true };
    };
    try {
      await run(sent);
    } finally {
      configureConversations({ signedIn: false });
      if (hadWindow) globals.window = previousWindow;
      else delete globals.window;
      globals.fetch = previousFetch;
    }
  };
}

/** Long enough for the queue's quiet period to pass. */
const afterTheQueue = () => new Promise((resolve) => setTimeout(resolve, 2200));

test(
  "AC-ACCT-004.3: a signed-in tab starts from the account's threads",
  withServer(async () => {
    const carried: Conversation = {
      id: "from-the-laptop",
      title: "CV cho VNG",
      savedAt: 5,
      events: [],
      session: undefined,
    };
    configureConversations({ signedIn: true, initial: [carried] });

    const [found] = loadConversations();
    assert.equal(found.id, "from-the-laptop");
    assert.equal(found.title, "CV cho VNG");
  }),
);

test(
  "a signed-in tab never shows threads left in this browser",
  withServer(async () => {
    // Somebody used this device before, signed out, and somebody else signed
    // in. The first person's questions must not be in the second's sidebar.
    configureConversations({ signedIn: false });
    upsertConversation({
      id: "somebody-else",
      title: "their question",
      savedAt: 1,
      events: [],
      session: undefined,
    });

    configureConversations({ signedIn: true, initial: [] });
    assert.deepEqual(loadConversations(), []);
  }),
);

test(
  "a saved conversation goes to the server and not to the browser",
  withServer(async (sent) => {
    configureConversations({ signedIn: true, initial: [] });
    upsertConversation({
      id: "new",
      title: "Mình nên học gì tiếp?",
      savedAt: 1,
      events: [],
      session: undefined,
    });

    // Readable at once, because the next read may be one line later.
    assert.deepEqual(loadConversations().map((c) => c.id), ["new"]);

    await afterTheQueue();
    assert.equal(sent.length, 1);
    const body = sent[0].body as { conversations: Conversation[] };
    assert.deepEqual(body.conversations.map((c) => c.id), ["new"]);
  }),
);

test(
  "a burst of saves becomes one request carrying the latest list",
  withServer(async (sent) => {
    configureConversations({ signedIn: true, initial: [] });
    // A conversation is saved on every stream event. One request per token
    // would be a transcript a second going to another continent.
    for (let i = 0; i < 5; i += 1) {
      upsertConversation({
        id: "streaming",
        title: "t",
        savedAt: i,
        events: [],
        session: undefined,
      });
    }

    await afterTheQueue();
    assert.equal(sent.length, 1, `expected one request, got ${sent.length}`);
    const body = sent[0].body as { conversations: Conversation[] };
    assert.equal(body.conversations[0].savedAt, 4, "the last save is the one sent");
  }),
);

test(
  "deleting a conversation reaches the account, not just the screen",
  withServer(async (sent) => {
    configureConversations({
      signedIn: true,
      initial: [
        { id: "a", title: "a", savedAt: 2, events: [], session: undefined },
        { id: "b", title: "b", savedAt: 1, events: [], session: undefined },
      ],
    });

    removeConversation("a");
    assert.deepEqual(loadConversations().map((c) => c.id), ["b"]);

    await afterTheQueue();
    const body = sent.at(-1)!.body as { conversations: Conversation[] };
    assert.deepEqual(body.conversations.map((c) => c.id), ["b"]);
  }),
);

test(
  "the tab flushing on its way out sends what the queue is holding",
  withServer(async (sent) => {
    const beacons: unknown[] = [];
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { sendBeacon: (_url: string, blob: unknown) => (beacons.push(blob), true) },
    });
    try {
      configureConversations({ signedIn: true, initial: [] });
      upsertConversation({
        id: "unsaved",
        title: "t",
        savedAt: 1,
        events: [],
        session: undefined,
      });
      // Inside the quiet period: without the flush, this is the end of the
      // thread somebody loses every time they close the tab.
      flushConversations();

      assert.equal(beacons.length, 1);
      assert.equal(sent.length, 0, "the beacon replaces the request");
    } finally {
      if (original) Object.defineProperty(globalThis, "navigator", original);
    }
  }),
);
