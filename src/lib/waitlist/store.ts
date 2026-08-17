import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client.server";
import { normalizeEmail } from "./email";

/**
 * The waiting list. The first thing this product stores centrally.
 *
 * ## Why this is not localStorage
 *
 * `AppState` is per-account. A waiting list inverts that: it is one list the
 * team reads, so the browser is exactly the wrong place for it.
 *
 * ## Why Postgres, and why it used to be Blob
 *
 * A few hundred addresses need no schema when the app has no database. That
 * was the argument for a private Vercel Blob store, and it held until accounts
 * arrived. There is one Postgres now, on Railway, and a second store is a
 * second credential, a second dashboard, and a second thing that can be down
 * while the rest of the product is not. The unique index on `email` is the
 * same guarantee the blob pathname-hash used to buy: two submits of the same
 * person are one row, and two concurrent submits cannot both insert.
 */

export type WaitlistSource = "landing" | "end-of-demo";

export type WaitlistEntry = {
  email: string;
  source: WaitlistSource;
  joinedAt: string;
};

function isSource(value: string): value is WaitlistSource {
  return value === "landing" || value === "end-of-demo";
}

/** True when this address is already on the list. */
export async function alreadyJoined(
  email: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<boolean> {
  const { rows } = await db.query<{ email: string }>(
    "select email from waitlist where email = $1",
    [normalizeEmail(email)],
  );
  return rows.length > 0;
}

/**
 * Add an address, or leave it exactly as it was.
 *
 * Returns whether this call created the entry. A repeat submission is not an
 * error: telling a stranger "you are already on this list" confirms membership
 * to anyone who can type an address, and it is unkind to someone who simply
 * forgot.
 */
export async function join(
  email: string,
  source: WaitlistSource,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<{ created: boolean }> {
  const normalized = normalizeEmail(email);
  const { rowCount } = await db.query(
    `insert into waitlist (email, source)
     values ($1, $2)
     on conflict (email) do nothing`,
    [normalized, source],
  );
  return { created: (rowCount ?? 0) > 0 };
}

/** Everyone on the list, newest first. For whoever reads it. */
export async function readAll(
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<WaitlistEntry[]> {
  const { rows } = await db.query<{
    email: string;
    source: string;
    joined_at: Date;
  }>("select email, source, joined_at from waitlist order by joined_at desc");
  return rows.map((row) => ({
    email: row.email,
    source: isSource(row.source) ? row.source : "landing",
    joinedAt: row.joined_at.toISOString(),
  }));
}
