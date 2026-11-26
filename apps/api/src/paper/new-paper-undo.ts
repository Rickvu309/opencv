import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"

export function deleteNewPaper(paper: { id: string; name: string }) {
  return {
    command: "paper.delete" as const,
    input: { docId: paper.id },
    expect: {
      query: "paper.read",
      input: { view: "info", docId: paper.id, writer: RICH_NATIVE_WRITER },
      matches: { name: paper.name },
      skipped:
        "This Paper was renamed or deleted after it was made, so Undo was skipped",
    },
  }
}
