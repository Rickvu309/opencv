import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client";

export const FILE_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export type FileMime = (typeof FILE_MIMES)[number];

export const MAX_FILE_BYTES = 5_000_000;

const EXT_MIMES: Record<string, FileMime> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function isFileMime(value: unknown): value is FileMime {
  return typeof value === "string" && (FILE_MIMES as readonly string[]).includes(value);
}

export function mimeFromName(fileName: string): FileMime | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ? (EXT_MIMES[ext] ?? null) : null;
}

export type StoredFile = { bytes: Buffer; mime: string; fileName: string; updatedAt: Date };

export async function readFile(
  accountId: string,
  uploadId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<StoredFile | null> {
  const { rows } = await db.query<{
    bytes: Buffer;
    mime: string;
    file_name: string;
    updated_at: Date;
  }>(
    "select bytes, mime, file_name, updated_at from paper_files where account_id = $1 and upload_id = $2",
    [accountId, uploadId],
  );
  if (!rows[0]) return null;
  return {
    bytes: rows[0].bytes,
    mime: rows[0].mime,
    fileName: rows[0].file_name,
    updatedAt: rows[0].updated_at,
  };
}

export async function writeFile(
  accountId: string,
  uploadId: string,
  bytes: Buffer,
  mime: FileMime,
  fileName: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into paper_files (account_id, upload_id, bytes, mime, file_name, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (account_id, upload_id) do update
       set bytes = excluded.bytes, mime = excluded.mime, file_name = excluded.file_name, updated_at = now()`,
    [accountId, uploadId, bytes, mime, fileName],
  );
}

export async function deleteFile(
  accountId: string,
  uploadId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query("delete from paper_files where account_id = $1 and upload_id = $2", [
    accountId,
    uploadId,
  ]);
}
