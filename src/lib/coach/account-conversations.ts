import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client.server";
import { MAX_CONVERSATIONS, MAX_EVENTS, type Conversation } from "./sessions";

/**
 * An account's Coach threads, on the server.
 *
 * The reason this exists rather than leaving them in the browser: a user who
 * signs in on their phone now gets their profile, their plan and their CVs, and
 * would have got an empty chat sidebar. Half a person's work following them and
 * half not is worse than either, because there is no rule they can learn.
 *
 * ## What is stored, and what is not
 *
 * The stream events, so a thread can be redrawn, and eve's `SessionState`, so
 * the Coach continues rather than restarts. Both under the caps the browser
 * already imposed. Nothing is summarised or rewritten on the way in: the events
 * are eve's to interpret, and a store that reshaped them would break the moment
 * eve changed what it emits.
 */

/** The shape a stored list must have before it is believed. */
function isConversation(value: unknown): value is Conversation {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<Conversation>;
  return typeof entry.id === "string" && Array.isArray(entry.events);
}

/**
 * Believe only what looks like a conversation, and only as many as the cap
 * allows.
 *
 * Applied on the way in as well as on the way out. The browser trims before it
 * sends, and this trims again, because "the client already did it" is not a
 * property the server can check and a row is what everyone else reads.
 */
export function sanitizeConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isConversation)
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
    .slice(0, MAX_CONVERSATIONS)
    .map((entry) => ({
      ...entry,
      // `initialEvents` must be an ordered prefix of the same session, so this
      // keeps the newest run rather than sampling across it.
      events: entry.events.slice(-MAX_EVENTS),
    }));
}

/** The account's threads, newest first. Empty when it has never talked. */
export async function readConversations(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Conversation[]> {
  const { rows } = await db.query<{ list: unknown }>(
    "select list from conversations where account_id = $1",
    [accountId],
  );
  if (!rows[0]) return [];
  return sanitizeConversations(rows[0].list);
}

/** Replace the account's threads with this list. */
export async function writeConversations(
  accountId: string,
  list: readonly Conversation[],
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into conversations (account_id, list, updated_at)
     values ($1, $2, now())
     on conflict (account_id) do update
       set list = excluded.list, updated_at = now()`,
    [accountId, JSON.stringify(sanitizeConversations(list))],
  );
}
