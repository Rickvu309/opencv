export function emptyPaper(kind: "cv" | "letter") {
  return {
    version: 3 as const,
    kind,
    blocks: [{ id: "paragraph-1", type: "paragraph" as const, content: [] }],
    clashes: [],
  }
}
