import type { LetterPaper } from "./types";

export function paragraphsOf(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function bodyFrom(paragraphs: readonly string[]): string {
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n");
}

export function isEmptyLetter(paper: LetterPaper): boolean {
  return paragraphsOf(paper.body).length === 0;
}
