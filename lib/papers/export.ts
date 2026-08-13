import { paperKindLabels, paragraphsOf, type ProseDocument } from "./types";

/**
 * Getting a prose document back out.
 *
 * Three ways, matching `lib/cv/export.ts` minus the one that does not apply:
 * there is no JSON export here, because a `ProseDocument` is a label and some
 * paragraphs, and its JSON is its plain text with punctuation around it. The CV
 * exports JSON because a CV has structure worth machine-reading.
 *
 * PDF is the browser's own print of the same layout the preview shows, for the
 * reason ADR-002 gives: a bundled renderer would add hundreds of kilobytes to
 * lay out HTML the page already lays out.
 */

/** A filename that survives a filesystem: no separators, no accents lost. */
export function fileStem(paper: ProseDocument): string {
  const base = [paper.label, paper.targetRole].filter((s) => s?.trim()).join(" - ");
  return (
    base
      .normalize("NFD")
      // Strip combining marks so "Trần" becomes "Tran" rather than "Trn".
      .replace(new RegExp("\\p{M}", "gu"), "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) ||
    // The kind, in the document's own language, because the file lands next to
    // other applications and "document.md" tells nobody which one it is.
    paperKindLabels[paper.kind][paper.language].replace(/\s+/g, "_")
  );
}

export function toMarkdown(paper: ProseDocument): string {
  const out: string[] = [`# ${paper.label}`];
  if (paper.targetRole?.trim()) out.push(`_${paper.targetRole.trim()}_`);
  for (const paragraph of paragraphsOf(paper.body)) out.push("", paragraph);
  return out.join("\n") + "\n";
}

export function toPlainText(paper: ProseDocument): string {
  const out: string[] = [paper.label];
  if (paper.targetRole?.trim()) out.push(paper.targetRole.trim());
  for (const paragraph of paragraphsOf(paper.body)) out.push("", paragraph);
  return out.join("\n") + "\n";
}
