export function paperEditBasisRefused(name: string, input: unknown) {
  if (name !== "paper.edit" || !input || typeof input !== "object") return false
  return typeof (input as { basedOn?: unknown }).basedOn !== "string"
}

export const paperEditBasisMessage =
  "This edit does not use a saved Word revision. Read the document again and propose Word operations against its revision."
