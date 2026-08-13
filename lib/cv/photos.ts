import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client";

/**
 * The photo on a CV, on the server.
 *
 * ## Why a photo is a real decision and not decoration
 *
 * A Vietnamese CV usually carries one and an international or tech CV usually
 * does not. Getting that wrong is not a style mistake: a photo on a CV sent to
 * a company that screens for bias is a reason to be filtered out, and no photo
 * on a CV sent to a Vietnamese employer reads as an incomplete application. So
 * the template decides whether the area exists, and the user decides what goes
 * in it.
 *
 * ## What is stored, and what is refused
 *
 * JPEG and PNG only, under a size the client has already reduced the image to.
 * The list is short on purpose: SVG is not on it, because an SVG is a document
 * that can carry script, and this one is rendered inside the app's own origin.
 */

export const PHOTO_MIMES = ["image/jpeg", "image/png"] as const;
export type PhotoMime = (typeof PHOTO_MIMES)[number];

/** After the client has downscaled. A brake on what reaches the row, not a budget. */
export const MAX_PHOTO_BYTES = 1_000_000;

export function isPhotoMime(value: unknown): value is PhotoMime {
  return typeof value === "string" && (PHOTO_MIMES as readonly string[]).includes(value);
}

export type StoredPhoto = { image: Buffer; mime: string; updatedAt: Date };

/**
 * One CV's photo, or null.
 *
 * The account is a parameter and never a default, for the reason every function
 * in `lib/state/account-state.ts` gives: the failure this guards against is
 * serving one person's face to another, and a missing argument should be a type
 * error rather than that.
 */
export async function readPhoto(
  accountId: string,
  resumeId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<StoredPhoto | null> {
  const { rows } = await db.query<{ image: Buffer; mime: string; updated_at: Date }>(
    "select image, mime, updated_at from cv_photos where account_id = $1 and resume_id = $2",
    [accountId, resumeId],
  );
  if (!rows[0]) return null;
  return { image: rows[0].image, mime: rows[0].mime, updatedAt: rows[0].updated_at };
}

/** Store or replace a CV's photo. */
export async function writePhoto(
  accountId: string,
  resumeId: string,
  image: Buffer,
  mime: PhotoMime,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into cv_photos (account_id, resume_id, image, mime, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (account_id, resume_id) do update
       set image = excluded.image, mime = excluded.mime, updated_at = now()`,
    [accountId, resumeId, image, mime],
  );
}

/** Remove it. Not an error when there was none: removing twice is a back button. */
export async function deletePhoto(
  accountId: string,
  resumeId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query("delete from cv_photos where account_id = $1 and resume_id = $2", [
    accountId,
    resumeId,
  ]);
}
