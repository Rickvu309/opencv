import bcrypt from "bcryptjs";
import type { ClientBase } from "pg";
import { z } from "zod";

import { getPool } from "@/lib/db/client";

/**
 * Who a person is: creating an identity, and proving one.
 *
 * ## What this deliberately does not do
 *
 * No email, no verification, no reset, no third party. ADR-001 defers all of
 * it, and the reason is worth keeping in view: every one of those is a whole
 * feature with its own failure modes, and none of them is what stands between
 * a student and their saved work today. A username and a password is.
 *
 * The cost is real and named: nobody can recover a forgotten password. That is
 * a known debt, not an oversight, and it sits behind this module's interface,
 * so paying it later does not touch anything that calls this.
 *
 * ## Why the failures are codes rather than sentences
 *
 * `app/api/waitlist` made this argument first: the server cannot know
 * whether this browser reads Vietnamese or English, and a server that guesses
 * gets it wrong for exactly the people this product exists for. So every
 * failure here is a stable string, and `lib/i18n/messages.ts` turns it into
 * something a person reads, in the language they chose.
 */

export type Account = {
  id: string;
  username: string;
  createdAt: Date;
};

/**
 * Everything that can go wrong, named.
 *
 * `bad-credentials` covers both "no such username" and "wrong password" on
 * purpose. Two different answers would let anyone with a form and a word list
 * find out which usernames exist, and knowing that is most of the work of
 * breaking into one. AC-ACCT-002.2 requires the single answer.
 */
export type AccountProblem =
  | "username-required"
  | "password-required"
  | "username-too-long"
  | "password-too-short"
  | "username-taken"
  | "bad-credentials";

export class AccountError extends Error {
  // Written out rather than as a constructor parameter property: Node strips
  // types without compiling them, and a parameter property is syntax that has
  // to be compiled. The test runner refuses the file otherwise.
  readonly code: AccountProblem;

  constructor(code: AccountProblem) {
    super(code);
    this.name = "AccountError";
    this.code = code;
  }
}

/**
 * Cost 10, which is bcrypt's usual default.
 *
 * The number is a deliberate trade, not a default accepted without looking. It
 * costs roughly 60ms per sign-in on the hardware this runs on, which nobody
 * notices once, and makes an offline attack on a stolen hash roughly ten
 * million times more expensive than a plain SHA. Raising it is a one-line
 * change that old hashes survive, because the cost is stored inside the hash.
 */
const COST = 10;

/**
 * Limits, and why each one exists.
 *
 * The maximum on the username is a storage sanity check, not a rule anyone
 * should meet. The minimum on the password is the only quality rule here: no
 * character-class requirements, because they push people toward `Password1!`
 * and away from the long ordinary phrase that is actually harder to guess.
 *
 * The bcrypt limit is not ours: the algorithm silently ignores anything past
 * 72 bytes, so a longer passphrase would have its tail quietly discarded and
 * two different passwords could both work. Rejecting is honest; truncating is
 * not.
 */
const credentials = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(8).max(72),
});

/** Which field is wrong, said precisely. AC-ACCT-001.3 asks for exactly this. */
function checkNew(username: unknown, password: unknown): { username: string; password: string } {
  if (typeof username !== "string" || username.trim().length === 0) {
    throw new AccountError("username-required");
  }
  if (typeof password !== "string" || password.length === 0) {
    throw new AccountError("password-required");
  }
  const parsed = credentials.safeParse({ username, password });
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    if (path === "username") throw new AccountError("username-too-long");
    throw new AccountError("password-too-short");
  }
  return parsed.data;
}

/**
 * Create an account, or fail saying why.
 *
 * Uniqueness is not checked before the insert. It is the database's unique
 * index that decides, and a `select` first would only move the race, not close
 * it: two sign-ups a millisecond apart would both find the name free. So the
 * insert is attempted and its rejection is translated.
 */
export async function createAccount(
  username: unknown,
  password: unknown,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Account> {
  const clean = checkNew(username, password);
  const hash = await bcrypt.hash(clean.password, COST);

  try {
    const { rows } = await db.query<{ id: string; username: string; created_at: Date }>(
      "insert into accounts (username, password_hash) values ($1, $2) returning id, username, created_at",
      [clean.username, hash],
    );
    return {
      id: rows[0].id,
      username: rows[0].username,
      createdAt: rows[0].created_at,
    };
  } catch (error) {
    // 23505 is unique_violation. Only one unique constraint exists on this
    // table, so there is no ambiguity about which name is taken.
    if ((error as { code?: string }).code === "23505") {
      throw new AccountError("username-taken");
    }
    throw error;
  }
}

/**
 * The account these credentials belong to, or a refusal.
 *
 * ## Why the hash is compared even when the username is unknown
 *
 * An early return on "no such user" answers in a millisecond, while a real
 * username answers in sixty, and that difference is measurable over a network.
 * Anyone can then discover which usernames exist by timing the form, which is
 * the thing AC-ACCT-002.2 exists to prevent, defeated through the side door.
 * So an unknown username is compared against a fixed hash of nothing useful,
 * and both paths cost the same.
 */
const DECOY_HASH = bcrypt.hashSync("no account has this password", COST);

export async function verifyCredentials(
  username: unknown,
  password: unknown,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Account> {
  // Not `checkNew`: an empty field at sign-in is not a different failure from a
  // wrong one, and saying "the username is required" to someone who left it
  // blank on purpose still confirms nothing. Empty simply cannot match.
  if (typeof username !== "string" || typeof password !== "string") {
    throw new AccountError("bad-credentials");
  }

  const { rows } = await db.query<{
    id: string;
    username: string;
    password_hash: string;
    created_at: Date;
  }>(
    "select id, username, password_hash, created_at from accounts where lower(username) = lower($1)",
    [username.trim()],
  );

  const found = rows[0];
  const matches = await bcrypt.compare(password, found?.password_hash ?? DECOY_HASH);
  if (!found || !matches) throw new AccountError("bad-credentials");

  return {
    id: found.id,
    username: found.username,
    createdAt: found.created_at,
  };
}

/** The account behind an id, or null. For the session layer to resolve a row. */
export async function accountById(
  id: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Account | null> {
  const { rows } = await db.query<{ id: string; username: string; created_at: Date }>(
    "select id, username, created_at from accounts where id = $1",
    [id],
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, username: rows[0].username, createdAt: rows[0].created_at };
}
