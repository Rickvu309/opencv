import { isLetterDocument, type LetterDocument } from "@workspace/domain"

export function readStoredLetter(source: unknown): LetterDocument {
  if (isLetterDocument(source)) return source
  const markdown =
    source && typeof source === "object"
      ? (source as { markdown?: unknown }).markdown
      : undefined
  return { markdown: typeof markdown === "string" ? markdown : "" }
}

export function paragraphsOf(body: string): string[] {
  return body.split("\n\n")
}
