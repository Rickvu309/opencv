// Conversations, plural.
//
// There was one. `chatTitle()` answered "Đoạn chat mới" or "Cuộc trò chuyện"
// because those are the only two things you can say about a thread when there
// is only ever one of it, and "Đoạn chat mới" threw the previous one away.
//
// A student does not have one career question. They have "CV cho VNG", "có nên
// học master không", "phỏng vấn thứ năm" — separate threads with separate
// context, asked weeks apart. Keeping one meant either losing the earlier one
// or letting the Coach answer a CV question with a master's degree still in its
// context window.
//
// eve sessions are already durable and already keyed; this stores the list of
// keys the browser knows about rather than a single one.

import type { MessageStreamEvent, SessionState } from "eve/client";

const KEY = "openpath:coach-conversations:v1";

/** The single-conversation key this replaces. Read once, then removed. */
const LEGACY_KEY = "openpath:coach-session:v1";

/** Enough events to redraw a thread without storing a transcript forever. */
const MAX_EVENTS = 400;

/**
 * How many conversations are kept.
 *
 * Not unbounded: every one of these carries up to 400 stream events, and
 * localStorage is a handful of megabytes that the app's own state also lives
 * in. Twelve is more than anyone will scroll and small enough that the oldest
 * falling off is a non-event.
 */
const MAX_CONVERSATIONS = 12;

export type Conversation = {
  id: string;
  /** What the user first asked, which is the only honest name for a thread. */
  title: string;
  /** Display order only; never parsed. See `lib/actions/registry` on clocks. */
  savedAt: number;
  events: readonly MessageStreamEvent[];
  session: SessionState | undefined;
};

/** Everything stored, newest first. */
export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isConversation).sort((a, b) => b.savedAt - a.savedAt);
    }
    return migrateLegacy();
  } catch {
    // A half-written or foreign blob is not worth recovering; a fresh list is a
    // smaller loss than a corrupted one.
    clearConversations();
    return [];
  }
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Partial<Conversation>;
  return typeof c.id === "string" && Array.isArray(c.events);
}

/**
 * Carry over the one conversation the previous version stored.
 *
 * Someone mid-thought when this shipped should not lose it, and this runs
 * exactly once: the old key is removed as soon as it has been read.
 */
function migrateLegacy(): Conversation[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw) as {
      events?: readonly MessageStreamEvent[];
      session?: SessionState;
    };
    window.localStorage.removeItem(LEGACY_KEY);
    if (!Array.isArray(saved.events) || saved.events.length === 0) return [];
    const carried: Conversation = {
      id: "carried-over",
      title: "",
      savedAt: 0,
      events: saved.events,
      session: saved.session,
    };
    saveConversations([carried]);
    return [carried];
  } catch {
    return [];
  }
}

export function saveConversations(list: readonly Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = [...list]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_CONVERSATIONS)
      .map((c) => ({
        ...c,
        // `initialEvents` must be an ordered prefix of the same session, so
        // this keeps the newest run rather than sampling across it.
        events: c.events.slice(-MAX_EVENTS),
      }));
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Private mode or a full quota. The conversation still works; it just will
    // not outlive the tab.
  }
}

/** Write one conversation into the list, replacing any earlier version. */
export function upsertConversation(entry: Conversation): Conversation[] {
  const rest = loadConversations().filter((c) => c.id !== entry.id);
  const next = [entry, ...rest];
  saveConversations(next);
  return next;
}

export function removeConversation(id: string): Conversation[] {
  const next = loadConversations().filter((c) => c.id !== id);
  saveConversations(next);
  return next;
}

export function clearConversations(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing to do.
  }
}

/**
 * A conversation's name: the first thing the user asked, trimmed to fit.
 *
 * Not model-generated. Naming a thread costs a turn, this model takes the
 * better part of a minute per turn, and "what you asked first" is both free and
 * what someone actually scans for when looking for a conversation again.
 */
export function conversationTitle(
  events: readonly MessageStreamEvent[],
): string {
  for (const event of events) {
    const message = (event as { data?: { message?: unknown } }).data?.message as
      | { role?: string; parts?: { type?: string; text?: string }[] }
      | undefined;
    if (message?.role !== "user") continue;
    const text = (message.parts ?? [])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (text) return text.slice(0, 80);
  }
  return "";
}
