import type { ProofNoteKind, ProofPaper } from "./types";

export type ProofSnapshotNote = {
  text: string;
  at: string;
  kind?: ProofNoteKind;
  url?: string;
  fileName?: string;
};

export type ProofSnapshot = {
  title: string;
  name?: string;
  role?: string;
  dates?: string;
  link?: string;
  why?: string;
  notes: ProofSnapshotNote[];
  publishedAt: string;
};

export type ProofPage = {
  slug: string;
  accountId: string;
  paperId: string;
  snapshot: ProofSnapshot;
  publishedAt: Date;
};

export type AccountSite = {
  accountId: string;
  handle: string;
};

const HANDLE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function isHandle(value: unknown): value is string {
  return typeof value === "string" && HANDLE.test(value);
}

export function slugifyHandle(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || "you";
}

export function defaultHandle(name: string, accountId: string): string {
  return `${slugifyHandle(name)}-${accountId.replace(/-/g, "").slice(0, 6)}`;
}

/** Slug and handle for a Publish. The route writes; this names. */
export function placementForPublish(input: {
  label: string;
  accountId: string;
  name: string;
  handle?: string;
}): { slug: string; handle: string } | null {
  const handle = input.handle ?? defaultHandle(input.name, input.accountId);
  if (!isHandle(handle)) return null;
  return {
    slug: `${slugifyHandle(input.label || "proof")}-${input.accountId.replace(/-/g, "").slice(0, 8)}`,
    handle,
  };
}

export function snapshotOf(
  paper: ProofPaper,
  at = new Date(),
  extras: { name?: string } = {},
): ProofSnapshot {
  const day = at.toISOString().slice(0, 10);
  const chosen = paper.arrangeNoteIds
    ? paper.arrangeNoteIds
        .map((id) => paper.notes.find((note) => note.id === id))
        .filter((note): note is NonNullable<typeof note> => Boolean(note))
    : paper.notes;
  return {
    title: paper.label,
    name: extras.name,
    role: paper.role,
    dates: paper.dates,
    link: paper.link,
    why: paper.why,
    notes: chosen.map((note) => ({
      text: note.text,
      at: /^\d{4}-\d{2}-\d{2}/.test(note.at) ? note.at.slice(0, 10) : day,
      ...(note.kind && note.kind !== "note" ? { kind: note.kind } : {}),
      ...(note.url ? { url: note.url } : {}),
      ...(note.fileName ? { fileName: note.fileName } : {}),
    })),
    publishedAt: at.toISOString(),
  };
}

export function loggedDays(pages: readonly ProofSnapshot[]): string[] {
  const days = new Set<string>();
  for (const page of pages) {
    if (page.publishedAt) days.add(page.publishedAt.slice(0, 10));
    for (const note of page.notes) {
      if (/^\d{4}-\d{2}-\d{2}/.test(note.at)) days.add(note.at.slice(0, 10));
    }
  }
  return [...days].sort();
}
