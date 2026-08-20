import { z } from "zod";

export const DUMP_PLACEHOLDER =
  "A café shift counts. Write it like a text.\n\nSaturday close. We ran out of oat milk and I stayed until the last table left.";

export const proofPageContentSchema = z.object({
  words: z.string(),
  date: z.string(),
  title: z.string().optional(),
  role: z.string().optional(),
  what: z.string().optional(),
  did: z.string().optional(),
  came: z.string().optional(),
});

export type ProofPageContent = z.infer<typeof proofPageContentSchema>;

function optionalPart(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function proofPageDate(
  meta: { dateFrom?: string | null; dateTo?: string | null },
  entries: { created_at?: Date | string | null }[],
) {
  const fromMeta = optionalPart(meta.dateFrom) ?? optionalPart(meta.dateTo);
  if (fromMeta) return fromMeta;
  const stamp = entries[0]?.created_at;
  if (stamp) {
    const date = stamp instanceof Date ? stamp : new Date(stamp);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export function buildProofPageContent(input: {
  words: string;
  date: string;
  title?: string | null;
  role?: string | null;
  draft?: { what?: unknown; did?: unknown; came?: unknown } | null;
}): ProofPageContent {
  const title = optionalPart(input.title);
  const content: ProofPageContent = {
    words: input.words.trim(),
    date: input.date,
  };
  if (title && title !== "Untitled Proof") content.title = title;
  const role = optionalPart(input.role);
  if (role) content.role = role;
  const what = optionalPart(input.draft?.what);
  const did = optionalPart(input.draft?.did);
  const came = optionalPart(input.draft?.came);
  if (what) content.what = what;
  if (did) content.did = did;
  if (came) content.came = came;
  return proofPageContentSchema.parse(content);
}
