import type { ClientBase } from "pg";

import { getPool } from "@/lib/db/client";
import type { ProofPaper } from "./types";

export type ProofSnapshot = {
  title: string;
  role?: string;
  dates?: string;
  link?: string;
  notes: { text: string; at: string }[];
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

export function snapshotOf(paper: ProofPaper, at = new Date()): ProofSnapshot {
  const day = at.toISOString().slice(0, 10);
  return {
    title: paper.label,
    role: paper.role,
    dates: paper.dates,
    link: paper.link,
    notes: paper.notes.map((note) => ({
      text: note.text,
      at: /^\d{4}-\d{2}-\d{2}/.test(note.at) ? note.at.slice(0, 10) : day,
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

export async function readSite(
  handle: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<AccountSite | null> {
  const { rows } = await db.query<{ account_id: string; handle: string }>(
    "select account_id, handle from account_sites where handle = $1",
    [handle],
  );
  if (!rows[0]) return null;
  return { accountId: rows[0].account_id, handle: rows[0].handle };
}

export async function readSiteForAccount(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<AccountSite | null> {
  const { rows } = await db.query<{ account_id: string; handle: string }>(
    "select account_id, handle from account_sites where account_id = $1",
    [accountId],
  );
  if (!rows[0]) return null;
  return { accountId: rows[0].account_id, handle: rows[0].handle };
}

export async function writeSite(
  accountId: string,
  handle: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into account_sites (account_id, handle)
     values ($1, $2)
     on conflict (account_id) do update set handle = excluded.handle`,
    [accountId, handle],
  );
}

export async function readProofPage(
  slug: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<ProofPage | null> {
  const { rows } = await db.query<{
    slug: string;
    account_id: string;
    paper_id: string;
    snapshot: ProofSnapshot;
    published_at: Date;
  }>(
    "select slug, account_id, paper_id, snapshot, published_at from proof_pages where slug = $1",
    [slug],
  );
  if (!rows[0]) return null;
  return {
    slug: rows[0].slug,
    accountId: rows[0].account_id,
    paperId: rows[0].paper_id,
    snapshot: rows[0].snapshot,
    publishedAt: rows[0].published_at,
  };
}

export async function listProofPages(
  accountId: string,
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<ProofPage[]> {
  const { rows } = await db.query<{
    slug: string;
    account_id: string;
    paper_id: string;
    snapshot: ProofSnapshot;
    published_at: Date;
  }>(
    "select slug, account_id, paper_id, snapshot, published_at from proof_pages where account_id = $1 order by published_at desc",
    [accountId],
  );
  return rows.map((row) => ({
    slug: row.slug,
    accountId: row.account_id,
    paperId: row.paper_id,
    snapshot: row.snapshot,
    publishedAt: row.published_at,
  }));
}

export async function writeProofPage(
  page: {
    slug: string;
    accountId: string;
    paperId: string;
    snapshot: ProofSnapshot;
  },
  db: Pick<ClientBase, "query"> = getPool(),
): Promise<void> {
  await db.query(
    `insert into proof_pages (slug, account_id, paper_id, snapshot, published_at)
     values ($1, $2, $3, $4, now())
     on conflict (slug) do update
       set snapshot = excluded.snapshot, published_at = now()`,
    [page.slug, page.accountId, page.paperId, JSON.stringify(page.snapshot)],
  );
}
