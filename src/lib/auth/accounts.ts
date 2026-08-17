import bcrypt from "bcryptjs";
import type { ClientBase } from "pg";
import { z } from "zod";

import { checkEmail, normalizeEmail } from "@/lib/email";
import { getPool } from "@/lib/db/client.server";

/**
 * Who a person is: creating an identity, and proving one.
 *
 * ## What this deliberately does not do
 *
 * No verification, no reset, no third party. Those are still named debt. The
 * login is an email and a password. A username is derived from the address so
 * public handles and traces do not carry it.
 *
 * The cost is real and named: nobody can recover a forgotten password. That is
 * a known debt, not an oversight, and it sits behind this module's interface,
 * so paying it later does not touch anything that calls this.
 *
 * ## Why the failures are codes rather than sentences
 *
 * The server cannot know whether this browser reads Vietnamese or English, and
 * a server that guesses gets it wrong for exactly the people this product
 * exists for. So every failure here is a stable string, and
 * `lib/i18n/messages.ts` turns it into something a person reads, in the
 * language they chose.
 */

export type Account = {
  id: string;
  username: string;
  email: string | null;
  createdAt: Date;
};

/**
 * Everything that can go wrong, named.
 *
 * `bad-credentials` covers both "no such email" and "wrong password" on
 * purpose. Two different answers would let anyone with a form and a word list
 * find out which emails exist, and knowing that is most of the work of
 * breaking into one. AC-ACCT-002.2 requires the single answer.
 */
export type AccountProblem =
  | "email-required"
  | "email-shape"
  | "email-taken"
  | "password-required"
  | "password-too-short"
  | "confirm-required"
  | "password-mismatch"
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
 * The minimum on the password is the only quality rule here: no
 * character-class requirements, because they push people toward `Password1!`
 * and away from the long ordinary phrase that is actually harder to guess.
 *
 * The bcrypt limit is not ours: the algorithm silently ignores anything past
 * 72 bytes, so a longer passphrase would have its tail quietly discarded and
 * two different passwords could both work. Rejecting is honest; truncating is
 * not.
 */
const passwordSchema = z.string().min(8).max(72);

const HANDLE_MAX = 64;

/** A public handle from the local part, never the whole address. */
export function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, HANDLE_MAX);
  return cleaned.length > 0 ? cleaned : "user";
}

function withSuffix(base: string, n: number): string {
  const suffix = `-${n}`;
  return (base.slice(0, HANDLE_MAX - suffix.length) + suffix);
}

function uniqueKind(error: unknown): "email" | "username" | null {
  if ((error as { code?: string }).code !== "23505") return null;
  const constraint = (error as { constraint?: string }).constraint ?? "";
  if (constraint.includes("email")) return "email";
  return "username";
}

function toAccount(row: {
  id: string;
  username: string;
  email: string | null;
  created_at: Date;
}): Account {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
  };
}

/** Which field is wrong, said precisely. AC-ACCT-001.3 asks for exactly this. */
function checkNew(
  email: unknown,
  password: unknown,
  confirmPassword: unknown,
): { email: string; password: string } {
  if (typeof email !== "string" || email.trim().length === 0) {
    throw new AccountError("email-required");
  }
  const emailProblem = checkEmail(email);
  if (emailProblem === "empty") throw new AccountError("email-required");
  if (emailProblem) throw new AccountError("email-shape");

  if (typeof password !== "string" || password.length === 0) {
    throw new AccountError("password-required");
  }
  if (!passwordSchema.safeParse(password).success) {
    throw new AccountError("password-too-short");
  }

  if (typeof confirmPassword !== "string" || confirmPassword.length === 0) {
    throw new AccountError("confirm-required");
  }
  if (confirmPassword !== password) {
    throw new AccountError("password-mismatch");
  }

  return { email: normalizeEmail(email), password };
}

/**
 * Create an account, or fail saying why.
 *
 * Uniqueness is not checked before the insert. It is the database's unique
 * index that decides, and a `select` first would only move the race, not close
 * it. So the insert is attempted and its rejection is translated.
 *
 * `confirmPassword` defaults to `password` so tests that already proved the
 * pair can omit the fourth argument. The sign-up handler always sends what
 * the person typed.
 */
export async function createAccount(
  email: unknown,
  password: unknown,
  db: Pick<ClientBase, "query"> = getPool(),
  confirmPassword: unknown = password,
): Promise<Account> {
  const clean = checkNew(email, password, confirmPassword);
  const hash = await bcrypt.hash(clean.password, COST);
  const base = handleFromEmail(clean.email);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const username = attempt === 0 ? base : withSuffix(base, attempt + 1);
    try {
      const { rows } = await db.query<{
        id: string;
        username: string;
        email: string | null;
        created_at: Date;
      }>(
        "insert into accounts (username, email, password_hash) values ($1, $2, $3) returning id, username, email, created_at",
        [username, clean.email, hash],
      );
      return toAccount(rows[0]);
    } catch (error) {
      const kind = uniqueKind(error);
      if (kind === "email") throw new AccountError("email-taken");
      if (kind === "username") continue;
      throw error;
    }
  }

  throw new AccountError("username-taken");
}

/**
 * The account these credentials belong to, or a refusal.
 *
 * ## Why the hash is compared even when the email is unknown
 *
 * An early return on "no such user" answers in a millisecond, while a real
 * email answers in sixty, and that difference is measurable over a network.
 * Anyone can then discover which emails exist by timing the form, which is
 * the thing AC-ACCT-002.2 exists to prevent, defeated through the side door.
 * So an unknown email is compared against a fixed hash of nothing useful,
 * and both paths cost the same.
 */
const DECOY_HASH = bcrypt.hashSync("no account has this password", COST);

export async function verifyCredentials(
  email: unknown,
  password: unknown,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Account> {
  // Not `checkNew`: an empty field at sign-in is not a different failure from a
  // wrong one, and saying "the email is required" to someone who left it
  // blank on purpose still confirms nothing. Empty simply cannot match.
  if (typeof email !== "string" || typeof password !== "string") {
    throw new AccountError("bad-credentials");
  }

  const lookup = email.trim();
  const { rows } = await db.query<{
    id: string;
    username: string;
    email: string | null;
    password_hash: string;
    created_at: Date;
  }>(
    `select id, username, email, password_hash, created_at
       from accounts
      where (email is not null and lower(email) = lower($1))
         or lower(username) = lower($1)
      order by case when email is not null and lower(email) = lower($1) then 0 else 1 end
      limit 1`,
    [lookup],
  );

  const found = rows[0];
  const matches = await bcrypt.compare(password, found?.password_hash ?? DECOY_HASH);
  if (!found || !matches) throw new AccountError("bad-credentials");

  return toAccount(found);
}

/** The account behind an id, or null. For the session layer to resolve a row. */
export async function accountById(
  id: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<Account | null> {
  const { rows } = await db.query<{
    id: string;
    username: string;
    email: string | null;
    created_at: Date;
  }>(
    "select id, username, email, created_at from accounts where id = $1",
    [id],
  );
  if (!rows[0]) return null;
  return toAccount(rows[0]);
}
