import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client.server";

export const PHOTO_MIMES = ["image/jpeg", "image/png"] as const;
export type PhotoMime = (typeof PHOTO_MIMES)[number];

export const MAX_PHOTO_BYTES = 1_000_000;

export function isPhotoMime(value: unknown): value is PhotoMime {
  return typeof value === "string" && (PHOTO_MIMES as readonly string[]).includes(value);
}

export type StoredPhoto = { image: Buffer; mime: string; updatedAt: Date };

export async function readPhoto(
  accountId: string,
  paperId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<StoredPhoto | null> {
  const { rows } = await db.query<{ image: Buffer; mime: string; updated_at: Date }>(
    "select image, mime, updated_at from paper_photos where account_id = $1 and paper_id = $2",
    [accountId, paperId],
  );
  if (!rows[0]) return null;
  return { image: rows[0].image, mime: rows[0].mime, updatedAt: rows[0].updated_at };
}

export async function writePhoto(
  accountId: string,
  paperId: string,
  image: Buffer,
  mime: PhotoMime,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into paper_photos (account_id, paper_id, image, mime, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (account_id, paper_id) do update
       set image = excluded.image, mime = excluded.mime, updated_at = now()`,
    [accountId, paperId, image, mime],
  );
}

export async function deletePhoto(
  accountId: string,
  paperId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query("delete from paper_photos where account_id = $1 and paper_id = $2", [
    accountId,
    paperId,
  ]);
}
