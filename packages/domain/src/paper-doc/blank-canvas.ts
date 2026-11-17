export function emptyPaper(kind: "cv" | "letter") {
  return {
    version: 3 as const,
    kind,
    blocks: [
      {
        id: kind === "letter" ? "letter-1" : "paragraph-1",
        type: "paragraph" as const,
        content: [],
      },
    ],
    clashes: [],
  }
}
