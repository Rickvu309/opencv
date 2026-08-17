import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client";
import { accountById, type Account } from "./accounts";
import { newToken, tokenHash } from "./cookie";

/**
 * The signed-in lifecycle: opening a door, checking one, and closing it.
 *
 * ## Why a row rather than only a signed cookie
 *
 * A self-contained cookie carrying the account id would need no table and no
 * query, and it would be impossible to revoke. Sign-out could clear the copy in
 * the browser that asked, and every other copy would keep working until it
 * expired: the one on the library computer, the one in the backup of a stolen
 * phone. AC-ACCT-003.2 says sign-out means the stored state is out of reach,
 * and only a record the server can delete makes that true.
 *
 * The row buys three more things worth having: a session can be ended without
 * the browser's help, every device on an account can be signed out at once, and
 * an account that is deleted takes its open sessions with it, by cascade.
 *
 * ## Why thirty days
 *
 * Long enough that the product does not feel like the one thing that forgets,
 * short enough that an abandoned session on a shared machine does not last a
 * year. The expiry is on the row and on the cookie together, so neither can
 * outlive the other.
 */

export const SESSION_DAYS = 30;

export type Session = {
  /** The value the browser must be given, before signing. */
  token: string;
  accountId: string;
  expiresAt: Date;
};

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Open a session for an account.
 *
 * Returns the token; storing it in a cookie is the caller's job, because this
 * module knows nothing about responses and is testable for exactly that reason.
 */
export async function startSession(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
  now: Date = new Date(),
): Promise<Session> {
  const token = newToken();
  const expiresAt = expiryFrom(now);
  await db.query(
    "insert into sessions (id, account_id, expires_at) values ($1, $2, $3)",
    [tokenHash(token), accountId, expiresAt],
  );
  return { token, accountId, expiresAt };
}

/**
 * The account this token belongs to, or null.
 *
 * Null covers every way of not being signed in, and they are deliberately not
 * distinguished: no session, an expired one, one that was signed out, one for
 * an account since deleted. The caller's response is the same in all four, and
 * telling them apart would only offer information to whoever is guessing.
 *
 * The expiry is enforced in the query rather than in JavaScript, so a clock
 * that disagrees with the database cannot extend a session.
 */
export async function readSession(
  token: string | null,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Account | null> {
  if (!token) return null;

  const { rows } = await db.query<{ account_id: string }>(
    "select account_id from sessions where id = $1 and expires_at > now()",
    [tokenHash(token)],
  );
  if (!rows[0]) return null;

  return accountById(rows[0].account_id, db);
}

/**
 * Close a session. Idempotent: a token that is already gone is not an error,
 * because signing out twice is a thing a person does with a back button.
 */
export async function endSession(
  token: string | null,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  if (!token) return;
  await db.query("delete from sessions where id = $1", [tokenHash(token)]);
}

/**
 * Close every session on an account.
 *
 * Nothing calls this yet. It exists because it is the answer to "my password
 * was seen", and building the row-backed session without it would be leaving
 * the reason for the row half unused.
 */
export async function endAllSessions(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query("delete from sessions where account_id = $1", [accountId]);
}

/**
 * Delete expired rows. Returns how many went.
 *
 * Expired sessions are already refused by `readSession`, so this is hygiene
 * rather than security: without it the table grows forever with rows that can
 * never be used again.
 */
export async function sweepExpiredSessions(
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<number> {
  const result = await db.query("delete from sessions where expires_at <= now()");
  return result.rowCount ?? 0;
}
