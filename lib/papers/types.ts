import type { DocumentLanguage, Msg } from "@/lib/i18n/locale";

/**
 * A document made of paragraphs.
 *
 * ## Why not a `Resume`
 *
 * `Resume` is a résumé: a header block, sections that are either prose or dated
 * entries, a template, an A4 layout. A cover letter has none of that. It is
 * four paragraphs and a greeting. Forcing it into `Resume` would mean a
 * document with one section, every entry field empty, a theme nothing renders,
 * and a completeness score computed from headings it does not have.
 *
 * The two share the *pattern*, granular registered actions, Coach drafting,
 * export, and nothing else. That is what this model is for.
 *
 * ## Why the body is one string
 *
 * Paragraphs are derived from it by splitting on blank lines rather than stored
 * as an array. Prose is what the user types into a textarea, and the round trip
 * through an array and back is where a trailing blank line becomes an empty
 * paragraph nobody asked for. The granular actions below address a paragraph by
 * index, computed the same way every time, so the Coach can still rewrite one
 * without resending the rest.
 */

export type PaperKind = "cover-letter" | "project-write-up";

export const paperKinds: PaperKind[] = ["cover-letter", "project-write-up"];

/** What each kind is called. */
export const paperKindLabels: Record<PaperKind, Msg> = {
  "cover-letter": "Cover letter",
  "project-write-up": "Project write-up",
};

export type ProseDocument = {
  id: string;
  kind: PaperKind;
  /** What the user calls this one, e.g. "Thư cho VNG". */
  label: string;
  /** What it is aimed at. A cover letter usually has one; a write-up may not. */
  targetRole?: string;
  /**
   * The document's own language. A letter for an English employer stays English
   * even when the writer is Vietnamese.
   */
  language: DocumentLanguage;
  body: string;
  /** A display string, not a timestamp; no clock skew between server and client. */
  updatedAt: string;
};

/**
 * The paragraphs of a body, in order.
 *
 * One definition, used by the editor, the export and the granular actions, so
 * "paragraph 2" means the same thing to all three. A blank line separates
 * paragraphs; a single newline does not, because that is how someone writes an
 * address block or a signature.
 */
export function paragraphsOf(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Paragraphs back into a body, spaced the way `paragraphsOf` expects. */
export function bodyFrom(paragraphs: readonly string[]): string {
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n");
}

/** True when this document would print nothing. */
export function isEmptyPaper(paper: ProseDocument): boolean {
  return paragraphsOf(paper.body).length === 0;
}
