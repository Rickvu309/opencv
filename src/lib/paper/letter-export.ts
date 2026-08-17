import { paperTypeLabels, type LetterPaper } from "./types";
import { paragraphsOf } from "./letter";

export function fileStem(paper: LetterPaper): string {
  const base = [paper.label, paper.targetRole].filter((s) => s?.trim()).join(" - ");
  return (
    base
      .normalize("NFD")
      .replace(new RegExp("\\p{M}", "gu"), "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || paperTypeLabels[paper.type].replace(/\s+/g, "_")
  );
}

export function toMarkdown(paper: LetterPaper): string {
  const out: string[] = [`# ${paper.label}`];
  if (paper.targetRole?.trim()) out.push(`_${paper.targetRole.trim()}_`);
  for (const paragraph of paragraphsOf(paper.body)) out.push("", paragraph);
  return out.join("\n") + "\n";
}

export function toPlainText(paper: LetterPaper): string {
  const out: string[] = [paper.label];
  if (paper.targetRole?.trim()) out.push(paper.targetRole.trim());
  for (const paragraph of paragraphsOf(paper.body)) out.push("", paragraph);
  return out.join("\n") + "\n";
}
