import type { LetterPaper, LetterSituation } from "./types";

export const letterSituationLabels: Record<LetterSituation, string> = {
  posted: "A posted job",
  internship: "An internship",
  speculative: "A company with no posting",
  scholarship: "A scholarship",
};

export function letterScaffold(situation: LetterSituation): string {
  switch (situation) {
    case "posted":
      return ["Why this job.", "The evidence.", "The close."].join("\n\n");
    case "internship":
      return ["The program.", "Coursework and projects.", "The close."].join(
        "\n\n",
      );
    case "speculative":
      return ["Why this company.", "What you would do.", "The close."].join(
        "\n\n",
      );
    case "scholarship":
      return ["The goal.", "The record.", "The fit."].join("\n\n");
  }
}

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
