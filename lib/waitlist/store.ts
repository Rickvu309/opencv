import { createHash } from "node:crypto";

import { get, head, list, put } from "@vercel/blob";

import { normalizeEmail } from "./email";

/**
 * The waiting list. The first thing this product stores centrally.
 *
 * ## Why this is not localStorage, when everything else is
 *
 * `AppState` lives in the browser on purpose: one shared demo account plus a
 * server store would show every visitor everyone else's edits. A waiting list
 * inverts that. It is not per-visitor state, it is one list the team reads, so
 * the browser is exactly the wrong place for it.
 *
 * ## Why Blob, and why a private store
 *
 * A few hundred addresses need no schema, no migrations and no connection
 * pooling inside a serverless function, which is most of the argument against
 * Postgres here. The store is **private**: Blob defaults to public, and a
 * public store means every blob is readable by URL, which is not a place to
 * keep strangers' email addresses. Verified `access: "private"` on the store.
 *
 * ## Why the pathname is a hash
 *
 * One blob per address, named by a hash of the normalized address. That buys
 * dedupe from the filesystem rather than from a read-modify-write: the same
 * address always lands on the same pathname, and `put` overwrites. Two people
 * submitting at once cannot produce two rows, which a list-then-append would
 * allow.
 *
 * The hash also keeps the address out of the pathname. Even in a private store,
 * a pathname is the part most likely to end up in a log or a dashboard.
 */

export type WaitlistSource = "landing" | "end-of-demo";

export type WaitlistEntry = {
  email: string;
  source: WaitlistSource;
  joinedAt: string;
};

const PREFIX = "waitlist/";

function pathnameFor(email: string): string {
  const digest = createHash("sha256").update(normalizeEmail(email)).digest("hex");
  return `${PREFIX}${digest}.json`;
}

/** True when this address is already on the list. */
export async function alreadyJoined(email: string): Promise<boolean> {
  try {
    await head(pathnameFor(email));
    return true;
  } catch {
    // `head` throws when the blob does not exist. Any other failure is also
    // safest read as "not known", because the caller's next step is a write
    // that overwrites rather than duplicates.
    return false;
  }
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
): Promise<{ created: boolean }> {
  const normalized = normalizeEmail(email);
  if (await alreadyJoined(normalized)) return { created: false };

  const entry: WaitlistEntry = {
    email: normalized,
    source,
    joinedAt: new Date().toISOString(),
  };

  await put(pathnameFor(normalized), JSON.stringify(entry), {
    // The store is private, and the SDK refuses a mismatch rather than silently
    // widening access. Good: this is the setting that keeps addresses off the
    // open internet, so it should be loud.
    access: "private",
    contentType: "application/json",
    // The pathname is the identity. A random suffix would give the same address
    // a new blob on every submit, which is exactly the duplicate this avoids.
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return { created: true };
}

/** Everyone on the list, newest first. For whoever reads it. */
export async function readAll(): Promise<WaitlistEntry[]> {
  const { blobs } = await list({ prefix: PREFIX });
  const entries = await Promise.all(
    blobs.map(async (blob) => {
      // `get`, not a plain fetch of `blob.url`: a private blob is not readable
      // without the token, which is the entire point of the private store.
      const result = await get(blob.pathname, { access: "private" });
      // `blob` on the result is metadata; the body is the stream.
      if (!result || result.statusCode !== 200) return null;
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as WaitlistEntry;
    }),
  );
  return entries
    .filter((entry): entry is WaitlistEntry => entry !== null)
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
}
