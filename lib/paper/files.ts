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
